const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const apiRouter = require('./api');

const app = express();
const PORT = 3002;

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 提供主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API路由
app.use('/api', apiRouter);

// 启动服务
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
