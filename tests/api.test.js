const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { once } = require('events');
const apiRouter = require('../api');

const dataDir = path.join(__dirname, '..', 'data');
const borrowersFile = path.join(dataDir, 'borrowers.json');
const loansFile = path.join(dataDir, 'loans.json');

function readFileSafely(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

test('POST /api/loans 返回创建的借贷记录并持久化数据', async () => {
  const originalBorrowers = readFileSafely(borrowersFile);
  const originalLoans = readFileSafely(loansFile);
  const borrowerId = 123456789;
  const testBorrower = { id: borrowerId, name: '测试用户', phone: '123456789' };
  writeJSON(borrowersFile, [testBorrower]);
  writeJSON(loansFile, []);

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerId: String(borrowerId),
        amount: 100,
        type: '借出',
        description: '单元测试'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();

    assert.ok(body.id, '响应中应包含自动生成的 id');
    assert.strictEqual(body.borrowerId, borrowerId);
    assert.strictEqual(body.amount, 100);
    assert.strictEqual(body.type, '借出');
    assert.strictEqual(body.description, '单元测试');
    assert.strictEqual(body.is_repaid, false);
    assert.ok(body.created_at, '响应应包含创建时间');

    const storedLoans = JSON.parse(fs.readFileSync(loansFile, 'utf8'));
    assert.strictEqual(storedLoans.length, 1);
    const storedLoan = storedLoans[0];
    assert.strictEqual(storedLoan.borrowerId, borrowerId);
    assert.strictEqual(storedLoan.amount, 100);
    assert.strictEqual(storedLoan.description, '单元测试');
  } finally {
    server.close();
    fs.writeFileSync(borrowersFile, originalBorrowers);
    fs.writeFileSync(loansFile, originalLoans);
  }
});
