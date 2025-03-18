const port = 7894;
var express = require('express');
var app = express();
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql2');
const { log } = require('console');
const readline = require('readline');

var serveIndex = require('serve-index');
// 指定 ffmpeg 的路径
ffmpeg.setFfmpegPath('D:\\ffmpeg\\bin\\ffmpeg.exe'); // 替换为你的 ffmpeg.exe 的实际路径

// 创建 MySQL 连接
const db = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'blibliapi',
    waitForConnections: true,
    charset: 'utf8mb4', // 指定使用 utf8mb4 字符集
    connectionLimit: 10, // 最大连接数
    queueLimit: 0,       // 队列限制
});
setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) console.error('心跳检测失败:', err);
        else console.log('数据库心跳检测成功');
    });
}, 30000); // 每 30 秒发送一次心跳

db.connect((err) => {
    if (err) {
        console.error('数据库连接失败:', err);
        return;
    }
    console.log('成功连接到数据库');
});
// 指定文件夹路径
const downloadDir = path.join(__dirname, 'download');
const videoDir = path.join(__dirname, 'video');
const csvFile = path.join(__dirname, "login_data.csv");
// 提供静态文件服务和目录浏览功能
app.use('/', express.static(videoDir), serveIndex(videoDir, { 'icons': true }));
// 创建一个新的 GET 路由来获取所有视频信息数据
app.get('/videos', (req, res) => {
    db.query('SELECT * FROM videos', (err, results) => {
        if (err) {
            console.error("数据库查询失败:", err);
            return res.status(500).json({ error: "数据库查询失败" });
        }

        // 返回所有视频信息
        res.json({
            message: '成功获取视频列表',
            data: results
        });
    });
});


async function loadLoginData() {
    try {
        const fileStream = fs.createReadStream(csvFile);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        const lines = [];
        for await (const line of rl) {
            lines.push(line);
        }

        // 从后往前遍历行
        for (let i = lines.length - 1; i >= 0; i--) {
            const row = lines[i].split(','); // 假设每行数据用逗号分隔
            const [dedeuserid, bili_jct, cookie_string, status, login_time] = row;

            // 判断 status 是否为 "1"，即用户未退出
            if (status === "1") {
                current_login = {
                    dedeuserid: dedeuserid,
                    bili_jct: bili_jct,
                    cookie_string: cookie_string,
                    is_logged_in: true
                };
                console.log('恢复登录状态:', current_login);
                break;
            }
        }

        if (!current_login.is_logged_in) {
            console.log('未找到有效的登录数据');
        }
    } catch (error) {
        console.error('读取登录数据时出错:', error.message);
    }
}
// 爬取视频信息
async function scrapeBilibiliVideo(url) {
    try {
        const cookieString = loadLoginData(); // 从文件中读取 cookies
        console.info('读取的 Cookie 字符串:', cookieString);
        
        if (!cookieString) {
            throw new Error("未找到有效的登录 cookies，请先登录。");
        }
        const headers = {
            'Referer': 'https://www.bilibili.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'Accept-Encoding': 'gzip, deflate',
            'Referer': 'https://www.bilibili.com/read/cv34766197/',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Priority': 'u=1',
            'TE': 'trailers',
            'Cookie': cookieString, // 添加 cookies
        };
        const response = await axios.get(url, { headers });
        // console.log(response.data); // 查看完整返回内容
        const $ = cheerio.load(response.data);
        // 提取播放信息
        const playInfoMatch = response.data.match(/<script>window\.__playinfo__=(.*?)<\/script>/);
        const videoInfoMatch = response.data.match(/<script>window\.__INITIAL_STATE__=(\{.*?\});/);

        if (!playInfoMatch || !videoInfoMatch) {
            throw new Error("无法获取视频信息");
        }
        // console.log(videoInfoMatch);
        

        const playInfo = JSON.parse(playInfoMatch[1]);
        const videoInfo = JSON.parse(videoInfoMatch[1]);

        const videoUrl = playInfo.data.dash.video[0].baseUrl;
        const audioUrl = playInfo.data.dash.audio[0].baseUrl;
        // const videoUrl = playInfo.data.dash.video[0].backupUrl[0];
        // const audioUrl = playInfo.data.dash.audio[0].backup_url[0];

        console.log(videoInfo.videoData.cid);
        
        // 视频相关信息
        return {
            videoUrl,
            audioUrl,
            bvid: videoInfo.videoData.bvid,
            aid: videoInfo.videoData.aid,
            cid: videoInfo.videoData.cid,
            tname: videoInfo.videoData.tname,
            pic: videoInfo.videoData.pic,
            title: videoInfo.videoData.title,
            desc: videoInfo.videoData.desc,
            duration: videoInfo.videoData.duration,
            pubdate: videoInfo.videoData.pubdate,
            name: videoInfo.videoData.owner.name,
            face: videoInfo.videoData.owner.face,
            view: videoInfo.videoData.stat.view,
            danmaku: videoInfo.videoData.stat.danmaku,
            reply: videoInfo.videoData.stat.reply,
            favorite: videoInfo.videoData.stat.favorite,
            coin: videoInfo.videoData.stat.coin,
            share: videoInfo.videoData.stat.share,
            like: videoInfo.videoData.stat.like,
        };
    } catch (error) {
        console.error("爬取视频信息失败:", error.message);
        throw error;
    }
}
const flaskDownloadUrl = 'http://127.0.0.1:7893/download';
// 下载视频和音频并合并

async function downloadAndMerge(videoData) {
    const { bvid, cid } = videoData;
    const downloadDir = path.join(__dirname, 'download'); // 临时文件夹
    const videoDir = path.join(__dirname, 'video'); // 最终输出文件夹

    // 确保文件夹存在
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir);
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir);

    const quality = 80; // 默认清晰度

    try {
        // 向 Flask 后端发送请求，获取视频和音频的下载地址
        console.log(`请求下载视频和音频，bvid: ${bvid}, cid: ${cid}, quality: ${quality}`);
        const response = await axios.get(flaskDownloadUrl, {
            params: { bvid, cid, quality }
        });

        const { video_file, audio_file, message } = response.data;
        if (!video_file || !audio_file || message !== "下载成功") {
            throw new Error(`未能成功下载视频或音频，服务器返回消息: ${message}`);
        }

        // 定义视频和音频的文件路径
        const videoFilePath = path.join(downloadDir, `${bvid}.mp4`);
        const audioFilePath = path.join(downloadDir, `${bvid}.mp3`);

        // 使用 ffmpeg 合并视频和音频
        console.log(`开始合并视频和音频: ${videoFilePath} + ${audioFilePath}`);
        const outputFilePath = path.join(videoDir, `${bvid}.mp4`);
        await mergeVideoAndAudio(videoFilePath, audioFilePath, outputFilePath);

        // 清理临时下载文件（如果需要）
        fs.unlinkSync(videoFilePath);
        fs.unlinkSync(audioFilePath);
        console.log(`视频和音频合并完成，输出文件: ${outputFilePath}`);
        return outputFilePath;

    } catch (err) {
        console.error('下载或合并失败:', err.message);
        throw err;
    }
}

function mergeVideoAndAudio(videoFilePath, audioFilePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoFilePath)
            .addInput(audioFilePath)
            .audioCodec('aac')
            .videoCodec('h264_nvenc')
            .on('end', () => {
                console.log(`合并完成，输出文件: ${outputFilePath}`);
                resolve();
            })
            .on('error', (err) => {
                console.error('合并失败:', err);
                reject(err);
            })
            .save(outputFilePath);
    });
}

// 处理视频下载请求
app.get('/video', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: '请提供视频URL' });
    // 从 URL 中提取 Bilibili 视频 ID
    const videoIdMatch = url.match(/BV[0-9A-Za-z]+/);
    if (!videoIdMatch) {
        return res.status(400).json({ error: '无效的视频URL' });
    }
    const videoId = videoIdMatch[0];
    try {
        const videoData = await scrapeBilibiliVideo(url);
        //console.log(videoData);
        // 查询数据库是否已有记录
        const [rows] = await db.promise().query('SELECT * FROM videos WHERE bvid = ?', [videoId]);
        if (rows.length > 0) {//在数据库内
            const updatedVideoData = {
                bvid:videoData.bvid,
                aid:videoData.aid,
                cid:videoData.cid,
                tname:videoData.tname,
                pic:videoData.pic,
                title:videoData.title,
                desc:videoData.desc,
                duration:videoData.duration,
                pubdate:videoData.pubdate,
                name:videoData.name,
                face:videoData.face,
                view:videoData.view,
                danmaku:videoData.danmaku,
                reply:videoData.reply,
                favorite:videoData.favorite,
                coin:videoData.coin,
                share:videoData.share,
                like:videoData.like,
                download_link: `http://10.3.36.10:${port}/${videoId}.mp4`
            };

            // 更新数据库中的视频信息
            db.query('UPDATE videos SET ? WHERE bvid = ?', [updatedVideoData, videoId], (err) => {
                if (err) {
                    console.error("数据库更新失败:", err);
                    return res.status(500).json({ error: "数据库更新失败" });
                }

                console.log("视频信息成功更新");

                // 返回更新后的视频信息
                const downloadLink = `http://10.3.36.10:${port}/${videoId}.mp4`;
                return res.json({
                    message: '视频信息已更新',
                    data: updatedVideoData,
                    downloadLink: downloadLink
                });
            });

        }else{
            // 下载和合并视频
            const videoPath = await downloadAndMerge(videoData);
                // 保存到数据库
                const newVideoData = {
                    bvid:videoData.bvid,
                    aid:videoData.aid,
                    cid:videoData.cid,
                    tname:videoData.tname,
                    pic:videoData.pic,
                    title:videoData.title,
                    desc:videoData.desc,
                    duration:videoData.duration,
                    pubdate:videoData.pubdate,
                    name:videoData.name,
                    face:videoData.face,
                    view:videoData.view,
                    danmaku:videoData.danmaku,
                    reply:videoData.reply,
                    favorite:videoData.favorite,
                    coin:videoData.coin,
                    share:videoData.share,
                    like:videoData.like,       
                    download_link: `http://10.3.36.10:${port}/${videoId}.mp4`
                };

                db.query('INSERT INTO videos SET ?', newVideoData, (err) => {
                    if (err) {
                        console.error("数据库插入失败:", err);
                    }
                    console.log("视频信息成功存储到数据库");

                    // 查询刚刚插入的视频数据，并返回
                    db.query('SELECT * FROM videos WHERE bvid = ?', [videoId], (err, results) => {
                        if (err) {
                            console.error("数据库查询失败:", err);
                            return res.status(500).json({ error: "数据库查询失败" });
                        }

                        // 返回包含视频信息和下载链接的响应
                        const videoData = results[0];
                        const downloadLink = `http://10.3.36.10:${port}/${videoId}.mp4`;
                        return res.json({
                            message: '视频信息已从数据库获取',
                            data: videoData,
                            downloadLink: downloadLink
                        });
                    });
                });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});





function handleDisconnect() {
    db.connect((err) => {
        if (err) {
            console.error('数据库重连失败，5秒后重试:', err);
            setTimeout(handleDisconnect, 5000); // 5 秒后重试
        } else {
            console.log('成功重连到数据库');
        }
    });

    // 捕获连接关闭事件
    db.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('数据库连接丢失，尝试重连...');
            handleDisconnect(); // 递归调用重连
        } else {
            throw err;
        }
    });
}

// 初始化连接
handleDisconnect();

app.listen(port, () => {
    console.log(`服务器运行在 http://10.3.36.10:${port}`);
});
