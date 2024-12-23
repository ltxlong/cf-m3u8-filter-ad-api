// 全局变量声明
let ts_name_len = 0 // ts前缀长度
let ts_name_len_extend = 1 // 容错
let first_extinf_row = ''
let the_extinf_judge_row_n = 0
let the_same_extinf_name_n = 0
let the_extinf_benchmark_n = 5 // 基准
let prev_ts_name_index = -1 // 上个ts序列号
let first_ts_name_index = -1 // 首个ts序列号
let ts_type = 0 // 0：xxxx000数字递增.ts模式0 ；1：xxxxxxxxxx.ts模式1 ；2：***.ts模式2-暴力拆解
let the_ext_x_mode = 0 // 0：ext_x_discontinuity判断模式0 ；1：ext_x_discontinuity判断模式1
let violent_filter_mode_flag = false // 是否启用暴力拆解模式，默认否-自动判断模式

export default {
    async fetch(request, env) {
        try {
            filter_log('----------------------------插播广告过滤--------------------------');
            
            violent_filter_mode_flag = env?.VIOLENT_FILTER_MODE_FLAG ?? violent_filter_mode_flag;

            let url = new URL(request.url).searchParams.get('url')

            // 如果没有查询参数，则尝试从路径中获取
            if (!targetUrl) {
                const path = url.pathname
                if (path.startsWith('/url/')) {
                    targetUrl = path.slice(5)  // 移除开头的 /url/
                }
            }
            
            // 如果没有url参数 或者 url非法
            if (!url || !isValidUrl(url)) {
                return new Response('hello world!', {
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                })
            }

            // 如果不是m3u8文件，直接返回原始请求
            if (!is_m3u8_file(url)) {
                return fetch(request)
            }

            let result = await filter(url)
            if (!result) {
                return fetch(request)
            }

            return new Response(result, {
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Access-Control-Allow-Origin': '*'
                }
            })
        } catch (e) {
            return fetch(request)
        }
    }
}

function filter_log(...msg) {

    console.log('%c[m3u8_filter_ad]', 'font-weight: bold; color: white; background-color: #70b566b0; padding: 2px; border-radius: 2px;', ...msg);

}

function isValidUrl(url) {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

function is_m3u8_file(url) {
    return /\.m3u8($|\?)/.test(url)
}

function extract_number_before_ts(str) {
    let matches = str.match(/(\d+)\.ts/)
    if (matches) {
        return parseInt(matches[1])
    }
    return null
}

function filter_lines(lines) {
    let result = [];

    if (violent_filter_mode_flag) {
        filter_log('----------------------------暴力拆解模式--------------------------');

        ts_type = 2; // ts命名模式
    } else {
        filter_log('----------------------------自动判断模式--------------------------');

        let the_normal_int_ts_n = 0;
        let the_diff_int_ts_n = 0;

        let last_ts_name_len = 0;

        // 初始化参数
        for (let i = 0; i < lines.length; i++) {

            const line = lines[i];

            // 初始化first_extinf_row
            if (the_extinf_judge_row_n === 0 && line.startsWith('#EXTINF')) {
                first_extinf_row = line;

                the_extinf_judge_row_n++;
            } else if (the_extinf_judge_row_n === 1 && line.startsWith('#EXTINF')) {
                if (line !== first_extinf_row) {
                    first_extinf_row = '';
                }

                the_extinf_judge_row_n++;
            }

            // 判断ts模式
            let the_ts_name_len = line.indexOf('.ts'); // ts前缀长度

            if (the_ts_name_len > 0) {

                if (the_extinf_judge_row_n === 1) {
                    ts_name_len = the_ts_name_len;
                }

                last_ts_name_len = the_ts_name_len;

                let ts_name_index = extract_number_before_ts(line);
                if (ts_name_index === null) {
                    if (the_extinf_judge_row_n === 1) {
                        ts_type = 1; // ts命名模式
                    } else if (the_extinf_judge_row_n === 2 && (ts_type === 1 || the_ts_name_len === ts_name_len)) {
                        ts_type = 1; // ts命名模式

                        filter_log('----------------------------识别ts模式1---------------------------');

                        break;
                    } else {
                        the_diff_int_ts_n++;
                    }
                } else {

                    // 如果序号相隔等于1: 模式0
                    // 如果序号相隔大于1，或其他：模式2（暴力拆解）

                    if (the_normal_int_ts_n === 0) {
                        // 初始化ts序列号
                        prev_ts_name_index = ts_name_index;
                        first_ts_name_index = ts_name_index;
                        prev_ts_name_index = first_ts_name_index - 1;
                    }

                    if (the_ts_name_len !== ts_name_len) {

                        if (the_ts_name_len === last_ts_name_len + 1 && ts_name_index === prev_ts_name_index + 1) {

                            if (the_diff_int_ts_n) {

                                if (ts_name_index === prev_ts_name_index + 1) {
                                    ts_type = 0; // ts命名模式
                                    prev_ts_name_index = first_ts_name_index - 1;

                                    filter_log('----------------------------识别ts模式0---------------------------')

                                    break;
                                } else {
                                    ts_type = 2; // ts命名模式

                                    filter_log('----------------------------识别ts模式2---------------------------')

                                    break;
                                }
                            }

                            the_normal_int_ts_n++;
                            prev_ts_name_index = ts_name_index;

                        } else {
                            the_diff_int_ts_n++;
                        }
                    } else {

                        if (the_diff_int_ts_n) {

                            if (ts_name_index === prev_ts_name_index + 1) {
                                ts_type = 0; // ts命名模式
                                prev_ts_name_index = first_ts_name_index - 1;

                                filter_log('----------------------------识别ts模式0---------------------------')

                                break;
                            } else {
                                ts_type = 2; // ts命名模式

                                filter_log('----------------------------识别ts模式2---------------------------')

                                break;
                            }
                        }

                        the_normal_int_ts_n++;
                        prev_ts_name_index = ts_name_index;
                    }
                }
            }

            if (i === lines.length - 1) {
                // 后缀不是ts，而是jpeg等等，或者以上规则判断不了的，或者没有广告切片的：直接暴力拆解过滤

                ts_type = 2; // ts命名模式

                filter_log('----------------------------进入暴力拆解模式---------------------------')
            }
        }
    }

    // 开始遍历过滤
    for (let i = 0; i < lines.length; i++) {

        let ts_index_check = false;

        const line = lines[i];

        if (ts_type === 0) {

            if (line.startsWith('#EXT-X-DISCONTINUITY') && lines[i + 1] && lines[i + 2]) {

                // 检查当前行是否跟 #EXT-X-PLAYLIST-TYPE相关
                if (i > 0 && lines[i - 1].startsWith('#EXT-X-PLAYLIST-TYPE')) {
                    result.push(line);

                    continue;
                } else {
                    let the_ts_name_len = lines[i + 2].indexOf('.ts'); // ts前缀长度

                    if (the_ts_name_len > 0) {

                        // 根据ts名字长度过滤
                        if (the_ts_name_len - ts_name_len > ts_name_len_extend) {
                            // 广告过滤
                            if (lines[i + 3] && lines[i + 3].startsWith('#EXT-X-DISCONTINUITY')) {
                                // 打印即将过滤的行
                                filter_log('过滤规则: #EXT-X-DISCONTINUITY-ts文件名长度-');
                                filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2], "\n", lines[i + 3]);
                                filter_log('------------------------------------------------------------------');

                                i += 3;
                            } else {
                                // 打印即将过滤的行
                                filter_log('过滤规则: #EXT-X-DISCONTINUITY-ts文件名长度');
                                filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2]);
                                filter_log('------------------------------------------------------------------');

                                i += 2;
                            }

                            continue;
                        } else {
                            ts_name_len = the_ts_name_len;
                        }

                        // 根据ts序列号过滤
                        let the_ts_name_index = extract_number_before_ts(lines[i + 2]);

                        if (the_ts_name_index !== prev_ts_name_index + 1) {

                            // 广告过滤
                            if (lines[i + 3] && lines[i + 3].startsWith('#EXT-X-DISCONTINUITY')) {
                                // 打印即将过滤的行
                                filter_log('过滤规则: #EXT-X-DISCONTINUITY-ts序列号-');
                                filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2], "\n", lines[i + 3]);
                                filter_log('------------------------------------------------------------------');

                                i += 3;
                            } else {
                                // 打印即将过滤的行
                                filter_log('过滤规则: #EXT-X-DISCONTINUITY-ts序列号');
                                filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2]);
                                filter_log('------------------------------------------------------------------');

                                i += 2;
                            }

                            continue;
                        }
                    }
                }
            }

            if (line.startsWith('#EXTINF') && lines[i + 1]) {

                let the_ts_name_len = lines[i + 1].indexOf('.ts'); // ts前缀长度

                if (the_ts_name_len > 0) {

                    // 根据ts名字长度过滤
                    if (the_ts_name_len - ts_name_len > ts_name_len_extend) {
                        // 广告过滤
                        if (lines[i + 2] && lines[i + 2].startsWith('#EXT-X-DISCONTINUITY')) {
                            // 打印即将过滤的行
                            filter_log('过滤规则: #EXTINF-ts文件名长度-');
                            filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2]);
                            filter_log('------------------------------------------------------------------');

                            i += 2;
                        } else {
                            // 打印即将过滤的行
                            filter_log('过滤规则: #EXTINF-ts文件名长度');
                            filter_log('过滤的行:', "\n", line, "\n", lines[i + 1]);
                            filter_log('------------------------------------------------------------------');

                            i += 1;
                        }

                        continue;
                    } else {
                        ts_name_len = the_ts_name_len;
                    }

                    // 根据ts序列号过滤
                    let the_ts_name_index = extract_number_before_ts(lines[i + 1]);

                    if (the_ts_name_index === prev_ts_name_index + 1) {

                        prev_ts_name_index++;

                    } else {
                        // 广告过滤
                        if (lines[i + 2].startsWith('#EXT-X-DISCONTINUITY')) {
                            // 打印即将过滤的行
                            filter_log('过滤规则: #EXTINF-ts序列号-');
                            filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2]);
                            filter_log('------------------------------------------------------------------');

                            i += 2;
                        } else {
                            // 打印即将过滤的行
                            filter_log('过滤规则: #EXTINF-ts序列号');
                            filter_log('过滤的行:', "\n", line, "\n", lines[i + 1]);
                            filter_log('------------------------------------------------------------------');

                            i += 1;
                        }

                        continue;
                    }
                }
            }
        } else if (ts_type === 1) {

            if (line.startsWith('#EXTINF')) {
                if (line === first_extinf_row && the_same_extinf_name_n <= the_extinf_benchmark_n && the_ext_x_mode === 0) {
                    the_same_extinf_name_n++;
                } else {
                    the_ext_x_mode = 1;
                }

                if (the_same_extinf_name_n > the_extinf_benchmark_n) {
                    the_ext_x_mode = 1;
                }
            }

            if (line.startsWith('#EXT-X-DISCONTINUITY')) {
                // 检查当前行是否跟 #EXT-X-PLAYLIST-TYPE相关
                if (i > 0 && lines[i - 1].startsWith('#EXT-X-PLAYLIST-TYPE')) {
                    result.push(line);

                    continue;
                } else {

                    // 如果第 i+2 行是 .ts 文件，跳过当前行和接下来的两行
                    if (lines[i + 1] && lines[i + 1].startsWith('#EXTINF') && lines[i + 2] && lines[i + 2].indexOf('.ts') > 0) {

                        let the_ext_x_discontinuity_condition_flag = false;

                        if (the_ext_x_mode === 1) {
                            the_ext_x_discontinuity_condition_flag = lines[i + 1] !== first_extinf_row && the_same_extinf_name_n > the_extinf_benchmark_n;
                        }

                        // 进一步检测第 i+3 行是否也是 #EXT-X-DISCONTINUITY
                        if (lines[i + 3] && lines[i + 3].startsWith('#EXT-X-DISCONTINUITY') && the_ext_x_discontinuity_condition_flag) {
                            // 打印即将过滤的行
                            filter_log('过滤规则: #EXT-X-DISCONTINUITY-广告-#EXT-X-DISCONTINUITY过滤');
                            filter_log('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2], "\n", lines[i + 3]);
                            filter_log('------------------------------------------------------------------');

                            i += 3; // 跳过当前行和接下来的三行
                        } else {
                            // 打印即将过滤的行
                            filter_log('过滤规则: #EXT-X-DISCONTINUITY-单个标识过滤');
                            filter_log('过滤的行:', "\n", line);
                            filter_log('------------------------------------------------------------------');
                        }

                        continue;
                    }
                }
            }
        } else {

            // 暴力拆解
            if (line.startsWith('#EXT-X-DISCONTINUITY')) {
                // 检查当前行是否跟 #EXT-X-PLAYLIST-TYPE相关
                if (i > 0 && lines[i - 1].startsWith('#EXT-X-PLAYLIST-TYPE')) {
                    result.push(line);

                    continue;
                } else {

                    // 打印即将过滤的行
                    filter_log('过滤规则: #EXT-X-DISCONTINUITY-单个标识过滤');
                    filter_log('过滤的行:', "\n", line);
                    filter_log('------------------------------------------------------------------');

                    continue;
                }
            }
        }

        // 保留不需要过滤的行
        result.push(line);
    }

    return result;
}

async function filter(url) {
    try {
        let response = await fetch(url)
        if (!response.ok) {
            return null
        }

        let m3u8Content = await response.text()
        let lines = m3u8Content.split('\n')
        let new_lines = filter_lines(lines)

        return new_lines.join('\n')
    } catch (e) {
        return null
    }
}
