api 代码：

php：

```
<?php

class M3u8FilterAdApi {

    private $ts_name_len = 0; // ts前缀长度

    private $ts_name_len_extend = 1; // 容错

    private $first_extinf_row = '';

    private $the_extinf_judge_row_n = 0;

    private $the_same_extinf_name_n = 0;

    private $the_extinf_benchmark_n = 5; // 基准

    private $prev_ts_name_index = -1; // 上个ts序列号

    private $first_ts_name_index = -1; // 首个ts序列号

    private $ts_type = 0; // 0：xxxx000数字递增.ts模式0 ；1：xxxxxxxxxx.ts模式1 ；2：***.ts模式2-暴力拆解

    private $the_ext_x_mode = 0; // 0：ext_x_discontinuity判断模式0 ；1：ext_x_discontinuity判断模式1

    private $violent_filter_mode_flag = false; // 是否暴力拆解模式，默认false，如需要使用可以自己修改默认值 或者 添加构造函数修改

    private function is_m3u8_file($url) {
        return preg_match('/\.m3u8($|\?)/', $url);
    }

    private function extract_number_before_ts($str) {
        // 匹配 .ts 前面的数字
        $match = preg_match('/(\d+)\.ts/', $str, $matches);

        if ($match) {
            // 使用 parseInt 去掉前导 0
            return intval($matches[1]);
        }

        return null; // 如果不匹配，返回 null
    }

    private function filter_lines($lines) {
        $result = [];

        if ($this->violent_filter_mode_flag) {
            // ('----------------------------暴力拆解模式--------------------------');

            $this->ts_type = 2; // ts命名模式
        } else {
            // ('----------------------------自动判断模式--------------------------');

            $the_normal_int_ts_n = 0;
            $the_diff_int_ts_n = 0;

            $last_ts_name_len = 0;

            // 初始化参数
            for ($i = 0; $i < count($lines); $i++) {

                $line = $lines[$i];

                // 初始化first_extinf_row
                if ($this->the_extinf_judge_row_n === 0 && strpos($line, '#EXTINF') === 0) {
                    $this->first_extinf_row = $line;

                    $this->the_extinf_judge_row_n++;
                } else if ($this->the_extinf_judge_row_n === 1 && strpos($line, '#EXTINF') === 0) {
                    if ($line !== $this->first_extinf_row) {
                        $this->first_extinf_row = '';
                    }

                    $this->the_extinf_judge_row_n++;
                }

                // 判断ts模式
                $the_ts_name_len = strpos($line, '.ts'); // ts前缀长度

                if ($the_ts_name_len) {

                    if ($this->the_extinf_judge_row_n === 1) {
                        $this->ts_name_len = $the_ts_name_len;
                    }

                    $last_ts_name_len = $the_ts_name_len;

                    $ts_name_index = $this->extract_number_before_ts($line);
                    if ($ts_name_index === null) {
                        if ($this->the_extinf_judge_row_n === 1) {
                            $this->ts_type = 1; // ts命名模式
                        } else if ($this->the_extinf_judge_row_n === 2 && ($this->ts_type === 1 || $the_ts_name_len === $this->ts_name_len)) {
                            $this->ts_type = 1; // ts命名模式

                            // ('----------------------------识别ts模式1---------------------------');

                            break;
                        } else {
                            $the_diff_int_ts_n++;
                        }
                    } else {

                        // 如果序号相隔等于1: 模式0
                        // 如果序号相隔大于1，或其他：模式2（暴力拆解）

                        if ($the_normal_int_ts_n === 0) {
                            // 初始化ts序列号
                            $this->prev_ts_name_index = $ts_name_index;
                            $this->first_ts_name_index = $ts_name_index;
                            $this->prev_ts_name_index = $this->first_ts_name_index - 1;
                        }

                        if ($the_ts_name_len !== $this->ts_name_len) {

                            if ($the_ts_name_len === $last_ts_name_len + 1 && $ts_name_index === $this->prev_ts_name_index + 1) {

                                if ($the_diff_int_ts_n) {

                                    if ($ts_name_index === $this->prev_ts_name_index + 1) {
                                        $this->ts_type = 0; // ts命名模式
                                        $this->prev_ts_name_index = $this->first_ts_name_index - 1;

                                        // ('----------------------------识别ts模式0---------------------------')

                                        break;
                                    } else {
                                        $this->ts_type = 2; // ts命名模式

                                        // ('----------------------------识别ts模式2---------------------------')

                                        break;
                                    }
                                }

                                $the_normal_int_ts_n++;
                                $this->prev_ts_name_index = $ts_name_index;

                            } else {
                                $the_diff_int_ts_n++;
                            }
                        } else {

                            if ($the_diff_int_ts_n) {

                                if ($ts_name_index === $this->prev_ts_name_index + 1) {
                                    $this->ts_type = 0; // ts命名模式
                                    $this->prev_ts_name_index = $this->first_ts_name_index - 1;

                                    // ('----------------------------识别ts模式0---------------------------')

                                    break;
                                } else {
                                    $this->ts_type = 2; // ts命名模式

                                    // ('----------------------------识别ts模式2---------------------------')

                                    break;
                                }
                            }

                            $the_normal_int_ts_n++;
                            $this->prev_ts_name_index = $ts_name_index;
                        }
                    }
                }

                if ($i === count($lines) - 1) {
                    // 后缀不是ts，而是jpeg等等，或者以上规则判断不了的，或者没有广告切片的：直接暴力拆解过滤

                    $this->ts_type = 2; // ts命名模式

                    // ('----------------------------进入暴力拆解模式---------------------------')
                }
            }
        }

        // 开始遍历过滤
        for ($i = 0; $i < count($lines); $i++) {

            $ts_index_check = false;

            $line = $lines[$i];

            if ($this->ts_type === 0) {

                if (strpos($line, '#EXT-X-DISCONTINUITY') === 0 && $lines[$i + 1] && $lines[$i + 2]) {

                    // 检查当前行是否跟 #EXT-X-PLAYLIST-TYPE相关
                    if ($i > 0 && strpos($lines[$i - 1], '#EXT-X-PLAYLIST-TYPE') === 0) {
                        $result[] = $line;

                        continue;
                    } else {
                        $the_ts_name_len = strpos($lines[$i + 2], '.ts'); // ts前缀长度

                        if ($the_ts_name_len) {

                            // 根据ts名字长度过滤
                            if ($the_ts_name_len - $this->ts_name_len > $this->ts_name_len_extend) {
                                // 广告过滤
                                if ($lines[$i + 3] && strpos($lines[$i + 3], '#EXT-X-DISCONTINUITY') === 0) {
                                    // 打印即将过滤的行
                                    // ('过滤规则: #EXT-X-DISCONTINUITY-ts文件名长度-');
                                    // ('过滤的行:', "\n", $line, "\n", $lines[$i + 1], "\n", $lines[$i + 2], "\n", $lines[$i + 3]);
                                    // ('------------------------------------------------------------------');

                                    $i += 3;
                                } else {
                                    // 打印即将过滤的行
                                    // ('过滤规则: #EXT-X-DISCONTINUITY-ts文件名长度');
                                    // ('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2]);
                                    // ('------------------------------------------------------------------');

                                    $i += 2;
                                }

                                continue;
                            } else {
                                $this->ts_name_len = $the_ts_name_len;
                            }

                            // 根据ts序列号过滤
                            $the_ts_name_index = $this->extract_number_before_ts($lines[$i + 2]);

                            if ($the_ts_name_index !== $this->prev_ts_name_index + 1) {

                                // 广告过滤
                                if ($lines[$i + 3] && strpos($lines[$i + 3], '#EXT-X-DISCONTINUITY') === 0) {
                                    // 打印即将过滤的行
                                    // ('过滤规则: #EXT-X-DISCONTINUITY-ts序列号-');
                                    // ('过滤的行:', "\n", $line, "\n", $lines[$i + 1], "\n", $lines[$i + 2], "\n", $lines[$i + 3]);
                                    // ('------------------------------------------------------------------');

                                    $i += 3;
                                } else {
                                    // 打印即将过滤的行
                                    // ('过滤规则: #EXT-X-DISCONTINUITY-ts序列号');
                                    // ('过滤的行:', "\n", line, "\n", lines[i + 1], "\n", lines[i + 2]);
                                    // ('------------------------------------------------------------------');

                                    $i += 2;
                                }

                                continue;
                            }
                        }
                    }
                }

                if (strpos($line, '#EXTINF') === 0 && $lines[$i + 1]) {

                    $the_ts_name_len = strpos($lines[$i + 1], '.ts'); // ts前缀长度

                    if ($the_ts_name_len) {

                        // 根据ts名字长度过滤
                        if ($the_ts_name_len - $this->ts_name_len > $this->ts_name_len_extend) {
                            // 广告过滤
                            if ($lines[$i + 2] && strpos($lines[$i + 2], '#EXT-X-DISCONTINUITY') === 0) {
                                // 打印即将过滤的行
                                // ('过滤规则: #EXTINF-ts文件名长度-');
                                // ('过滤的行:', "\n", $line, "\n", $lines[$i + 1], "\n", $lines[$i + 2]);
                                // ('------------------------------------------------------------------');

                                $i += 2;
                            } else {
                                // 打印即将过滤的行
                                // ('过滤规则: #EXTINF-ts文件名长度');
                                // ('过滤的行:', "\n", line, "\n", lines[i + 1]);
                                // ('------------------------------------------------------------------');

                                $i += 1;
                            }

                            continue;
                        } else {
                            $this->ts_name_len = $the_ts_name_len;
                        }

                        // 根据ts序列号过滤
                        $the_ts_name_index = $this->extract_number_before_ts($lines[$i + 1]);

                        if ($the_ts_name_index === $this->prev_ts_name_index + 1) {

                            $this->prev_ts_name_index++;

                        } else {
                            // 广告过滤
                            if ($lines[$i + 2] && strpos($lines[$i + 2], '#EXT-X-DISCONTINUITY') === 0) {
                                // 打印即将过滤的行
                                // ('过滤规则: #EXTINF-ts序列号-');
                                // ('过滤的行:', "\n", $line, "\n", $lines[$i + 1], "\n", $lines[$i + 2]);
                                // ('------------------------------------------------------------------');

                                $i += 2;
                            } else {
                                // 打印即将过滤的行
                                // ('过滤规则: #EXTINF-ts序列号');
                                // ('过滤的行:', "\n", line, "\n", lines[i + 1]);
                                // ('------------------------------------------------------------------');

                                $i += 1;
                            }

                            continue;
                        }
                    }
                }
            } else if ($this->ts_type === 1) {

                if (strpos($line, '#EXTINF') === 0) {
                    if ($line === $this->first_extinf_row && $this->the_same_extinf_name_n <= $this->the_extinf_benchmark_n && $this->the_ext_x_mode === 0) {
                        $this->the_same_extinf_name_n++;
                    } else {
                        $this->the_ext_x_mode = 1;
                    }

                    if ($this->the_same_extinf_name_n > $this->the_extinf_benchmark_n) {
                        $this->the_ext_x_mode = 1;
                    }
                }

                if (strpos($line, '#EXT-X-DISCONTINUITY') === 0) {
                    // 检查当前行是否跟 #EXT-X-PLAYLIST-TYPE相关
                    if ($i > 0 && strpos($lines[$i - 1], '#EXT-X-PLAYLIST-TYPE') === 0) {
                        $result[] = $line;

                        continue;
                    } else {

                        // 如果第 i+2 行是 .ts 文件，跳过当前行和接下来的两行
                        if ($lines[$i + 1] && strpos($lines[$i + 1], '#EXTINF') === 0 && $lines[$i + 2] && strpos($lines[$i + 2], '.ts')) {

                            $the_ext_x_discontinuity_condition_flag = false;

                            if ($this->the_ext_x_mode === 1) {
                                $the_ext_x_discontinuity_condition_flag = $lines[$i + 1] !== $this->first_extinf_row && $this->the_same_extinf_name_n > $this->the_extinf_benchmark_n;
                            }

                            // 进一步检测第 i+3 行是否也是 #EXT-X-DISCONTINUITY
                            if ($lines[$i + 3] && strpos($lines[$i + 3], '#EXT-X-DISCONTINUITY') === 0 && $the_ext_x_discontinuity_condition_flag) {
                                // 打印即将过滤的行
                                // ('过滤规则: #EXT-X-DISCONTINUITY-广告-#EXT-X-DISCONTINUITY过滤');
                                // ('过滤的行:', "\n", $line, "\n", $lines[$i + 1], "\n", $lines[$i + 2], "\n", $lines[$i + 3]);
                                // ('------------------------------------------------------------------');

                                $i += 3; // 跳过当前行和接下来的三行
                            } else {
                                // 打印即将过滤的行
                                // ('过滤规则: #EXT-X-DISCONTINUITY-单个标识过滤');
                                // ('过滤的行:', "\n", line);
                                // ('------------------------------------------------------------------');
                            }

                            continue;
                        }
                    }
                }
            } else {

                // 暴力拆解
                if (strpos($line, '#EXT-X-DISCONTINUITY') === 0) {
                    // 检查当前行是否跟 #EXT-X-PLAYLIST-TYPE相关
                    if ($i > 0 && strpos($lines[$i - 1], '#EXT-X-PLAYLIST-TYPE') === 0) {
                        $result[] = $line;

                        continue;
                    } else {

                        // 打印即将过滤的行
                        // ('过滤规则: #EXT-X-DISCONTINUITY-单个标识过滤');
                        // ('过滤的行:', "\n", line);
                        // ('------------------------------------------------------------------');

                        continue;
                    }
                }
            }

            // 保留不需要过滤的行
            $result[] = $line;
        }

        return $result;
    }

    public function filter($url) {
        try {
            if (!$this->is_m3u8_file($url)) {
                throw new Exception('url is not a m3u8 file');
            }

            $m3u8Content = @file_get_contents($url); 
            if (!$m3u8Content) {
                throw new Exception('get m3u8 content failed');
            }

            $lines = explode("\n", $m3u8Content);
            $new_lines = $this->filter_lines($lines);

            return implode("\n", $new_lines);
        } catch (Exception $e) {
            return null;
        }
    }
}

try {
    if (!isset($_GET['url'])) {
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        // 检查是否以 /url/ 开头
        if (strpos($path, '/url/') === 0) {
            $targetUrl = substr($path, 5); // 移除前面的 /url/
            if ($targetUrl) {
                // 如果不是以 http 开头（忽略大小写），就添加 https://
                if (!stripos($targetUrl, 'http') === 0) {
                    $targetUrl = 'https://' . $targetUrl;
                }
                $url = $targetUrl;
            } else {
                echo "Hello World!";
                exit;
            }
        } else {
            echo "Hello World!";
            exit;
        }
    } else {
        $url = $_GET['url'];
    }

    $m3u8FilterAdApi = new M3u8FilterAdApi();
    $result = $m3u8FilterAdApi->filter($url);   

    // 设置响应头
    header('Content-Type: application/vnd.apple.mpegurl');
    // 允许跨域
    header('Access-Control-Allow-Origin: *');

    if ($result) {
        echo $result;
    } else {
        echo null;
    }

    exit;
} catch (Exception $e) {
    echo null;
    exit;
}

?>

```


cf worker:

```
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

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event))
})

async function handleRequest(event) {
    const env = event.env;
    const request = event.request;

    filter_log('----------------------------插播广告过滤--------------------------');

    violent_filter_mode_flag = env?.VIOLENT_FILTER_MODE_FLAG ?? violent_filter_mode_flag;

    try {
        let url = new URL(request.url).searchParams.get('url')

        // 如果没有url参数
        if (!url) {
            // 如果没有查询参数，则尝试从路径中获取
            const path = new URL(request.url).pathname
            if (path.startsWith('/url/')) {
                url = path.slice(5)  // 移除开头的 /url/
            } else {
                return new Response('hello world!', {
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                })
            }
        }
    
        // 添加https://
        if (!url.startsWith('http')) {
            url = 'https://' + url
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
```


cf pages:
https://github.com/ltxlong/cf-m3u8-filter-ad-api

php版本部署在自己的服务器 或者 serv00

cf worker 和 cf pages 可以配置环境变量 VIOLENT_FILTER_MODE_FLAG，值为 true 或 false；若为true，则固定为暴力拆解过滤模式；不配置 或者 为false，则为自动判断过滤模式

cf worker 和 cf pages 虽然在浏览器控制台看不到打印的日志，但还是保留了相关代码

