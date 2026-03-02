# CDP-CLIENT-TOOL

为开发运行在安卓机linux系统上的数据抓取client端提供工具

## 设计

1. 获取客户端状态
提供一些函数获取客户端的状态，例如客户端是否存在脚本文件

2. 下发/执行脚本
可以直接下发符合mjs的字符串脚本，也可以将脚本存放至客户端再执行

3. 控制
使用 socket.io 链接网关控制，提供一套控制用的标准

4. 安卓浏览器控制
使用 puppeteer-core 通过 CDP 控制浏览器，提供一些常用代码流程

## 环境搭建

### windows/macos

### android

需要在安卓机上安装一套可于行的 linux 环境 (termux / aidlux)

1. 安装 git / nodejs  手机上安装 chrome浏览器
2. 安装 android-tools
3. 打开手机usb调试，使用数据线连接安卓手机，输入```adb tcpip 5555``` 打开远程调试端口
4. 输入```adb connect 192.168.1.100:5555``` 链接安卓手机
5. 输入```adb forward tcp:19222 localabstract:chrome_devtools_remote``` 打开手机chrome开发者端口，代码会使用 19222 端口
6. 启动项目连接网关

手机重启后需要重新连接并打开 19222 端口

## 关于网关

默认是用 socket.io 链接的，如果需要其他链接方式，你可以再 onInit 中自己写代码连接，不过建议还是使用 socket.io 能省很多事


### Event

类型
```ts
type SendMessageType<T = any> = {
    payload: T
}

type ReturnMessageType<T = any> = {
    code: string,
    payload: T
}
```

客户端预设
- setFile 下发文件
- deleteFile 删除文件
- getScreenShot 脚本控制浏览器截图，用这个获取截图 返回base64编码图片 (截图定期删除)

其余你自己自定义


### 需要解决的问题

- 内存泄漏
- 网络超时
- 执行队列
- 客户端文件管理(脚本/截图)