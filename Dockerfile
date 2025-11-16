# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-alpine

# 设置代理环境变量（构建时生效）
#ENV http_proxy="http://127.0.0.1:8118" \
#    https_proxy="http://127.0.0.1:8118" \
#    no_proxy="localhost,127.0.0.1,.internal"

# 设置工作目录
WORKDIR /app

# 将当前目录的内容复制到容器中的工作目录
COPY ./public/. .

# 安装应用依赖
RUN npm install

# 暴露容器的 3000 端口
EXPOSE 3002

# 启动应用
CMD ["node", "server.js"]
