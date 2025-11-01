const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const dataDir = path.join(__dirname, '../data');

// 获取 borrowers 数据
router.get('/borrowers', (req, res) => {
  try {
    let data = fs.readFileSync(path.join(dataDir, 'borrowers.json'), 'utf8');
    // 如果文件为空，返回空数组
    if (!data.trim()) {
      return res.json([]);
    }
    // 移除 BOM 头
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }
    try {
      res.json(JSON.parse(data));
    } catch (err) {
      res.json([]);
    }
  } catch (err) {
    res.json([]);
  }
});

// 添加 borrower
router.post('/borrowers', (req, res) => {
  const newBorrower = req.body;
  let borrowers = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'borrowers.json'), 'utf8');
    if (data.trim()) {
      borrowers = JSON.parse(data);
    }
  } catch (err) {
    borrowers = [];
  }
  
  if (newBorrower && newBorrower.name) {
    borrowers.push({
      id: Date.now(),
      ...newBorrower
    });
    fs.writeFileSync(path.join(dataDir, 'borrowers.json'), JSON.stringify(borrowers, null, 2));
  }
  res.json({ success: true });
});

// 删除 borrower
router.delete('/borrowers/:id', (req, res) => {
  const borrowerId = parseInt(req.params.id);
  
  // 检查是否存在借贷记录
  let loans = [];
  try {
    const loanData = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    if (loanData.trim()) {
      loans = JSON.parse(loanData);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read loans data' });
  }

  const hasLoans = loans.some(loan => loan.borrowerId === borrowerId);
  if (hasLoans) {
    return res.status(400).json({ 
      error: 'Cannot delete borrower with existing loans' 
    });
  }

  let borrowers = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'borrowers.json'), 'utf8');
    if (data.trim()) {
      borrowers = JSON.parse(data);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read borrowers data' });
  }

  // 查找并删除指定id的borrower
  const index = borrowers.findIndex(b => b.id === borrowerId);
  if (index === -1) {
    return res.status(404).json({ error: 'Borrower not found' });
  }

  borrowers.splice(index, 1);
  
  try {
    fs.writeFileSync(path.join(dataDir, 'borrowers.json'), JSON.stringify(borrowers, null, 2));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save borrowers data' });
  }
});

// 获取 loans 数据
router.get('/loans', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.json([]);
  }
});

// 添加 loan
router.post('/loans', (req, res) => {
  const newLoan = req.body;
  let loans = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    if (data.trim()) {
      loans = JSON.parse(data);
    }
  } catch (err) {
    loans = [];
  }
  
  if (!newLoan || !newLoan.amount || !newLoan.borrowerId) {
    return res.status(400).json({ error: 'Invalid loan data' });
  }

  // 验证 borrowerId 是否存在
  let borrowers = [];
  try {
    const borrowerData = fs.readFileSync(path.join(dataDir, 'borrowers.json'), 'utf8');
    if (borrowerData.trim()) {
      borrowers = JSON.parse(borrowerData);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read borrowers data' });
  }

  const borrowerExists = borrowers.some(b => b.id === parseInt(newLoan.borrowerId));
  if (!borrowerExists) {
    return res.status(400).json({ error: 'Borrower not found' });
  }

  try {
    loans.push({
      id: Date.now(),
      amount: parseFloat(newLoan.amount),
      borrowerId: parseInt(newLoan.borrowerId),
      type: newLoan.type || '借出',
      description: newLoan.description || '',
      is_repaid: false,
      created_at: new Date().toISOString()
    });
    fs.writeFileSync(path.join(dataDir, 'loans.json'), JSON.stringify(loans, null, 2));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save loan' });
  }
});

// 删除 loan
router.delete('/loans/:id', (req, res) => {
  const loanId = parseInt(req.params.id);
  let loans = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    if (data.trim()) {
      loans = JSON.parse(data);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read loans data' });
  }

  const index = loans.findIndex(l => l.id === loanId);
  if (index === -1) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  loans.splice(index, 1);
  
  try {
    fs.writeFileSync(path.join(dataDir, 'loans.json'), JSON.stringify(loans, null, 2));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save loans data' });
  }
});

// 切换还款状态
router.patch('/loans/:id/toggle-repaid', (req, res) => {
  const loanId = parseInt(req.params.id);
  let loans = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    if (data.trim()) {
      loans = JSON.parse(data);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read loans data' });
  }

  const loan = loans.find(l => l.id === loanId);
  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  loan.is_repaid = !loan.is_repaid;
  
  try {
    fs.writeFileSync(path.join(dataDir, 'loans.json'), JSON.stringify(loans, null, 2));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save loans data' });
  }
});

// 获取还款记录
router.get('/loans/:id/repayments', (req, res) => {
  const loanId = parseInt(req.params.id);
  
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    if (!data.trim()) {
      return res.json({
        loan_amount: 0,
        repayments: [],
        total_repaid: 0,
        remaining: 0
      });
    }
    
    const loans = JSON.parse(data);
    const loan = loans.find(l => l.id === loanId);
    
    if (!loan) {
      return res.status(404).json({ error: '未找到借贷记录' });
    }

    // 计算已还总额
    const repayments = loan.repayments || [];
    const total_repaid = repayments.reduce((sum, repayment) => sum + repayment.amount, 0);

    return res.json({
      loan_amount: loan.amount,
      repayments: repayments,
      total_repaid: total_repaid,
      remaining: loan.amount - total_repaid
    });
  } catch (err) {
    console.error('读取还款记录失败:', err);
    return res.status(500).json({ error: '读取还款记录失败' });
  }
});

// 添加部分还款记录
router.post('/loans/:id/partial-repayment', (req, res) => {
  const loanId = parseInt(req.params.id);
  const { amount, repayment_date = new Date().toISOString(), note = '' } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '还款金额无效' });
  }

  let loans = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    if (data.trim()) {
      loans = JSON.parse(data);
    }
  } catch (err) {
    return res.status(500).json({ error: '读取借贷数据失败' });
  }

  const loan = loans.find(l => l.id === loanId);
  if (!loan) {
    return res.status(404).json({ error: '未找到借贷记录' });
  }

  // 初始化还款记录数组（如果不存在）
  if (!loan.repayments) {
    loan.repayments = [];
  }

  // 计算已还款总额
  const totalRepaid = loan.repayments.reduce((sum, repayment) => sum + repayment.amount, 0);
  
  // 检查还款金额是否超过未还金额
  if (totalRepaid + parseFloat(amount) > loan.amount) {
    return res.status(400).json({ error: '还款金额超过借贷金额' });
  }

  // 添加新的还款记录
  loan.repayments.push({
    id: Date.now(),
    amount: parseFloat(amount),
    date: repayment_date,
    note: note
  });

  // 如果全部还清，更新还款状态
  if (totalRepaid + parseFloat(amount) === loan.amount) {
    loan.is_repaid = true;
  }

  try {
    fs.writeFileSync(path.join(dataDir, 'loans.json'), JSON.stringify(loans, null, 2));
    return res.json({ 
      success: true, 
      loan: {
        ...loan,
        remaining: loan.amount - (totalRepaid + parseFloat(amount))
      }
    });
  } catch (err) {
    return res.status(500).json({ error: '保存还款记录失败' });
  }
});

// 添加登录接口
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // 简单的验证，实际应用中应该使用加密密码
  if (username === 'admin' && password === 'admin') {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 修改删除还款记录的接口
router.delete('/loans/:loanId/repayments/:repaymentId', (req, res) => {
  const loanId = parseInt(req.params.loanId);
  const repaymentId = parseInt(req.params.repaymentId);
  
  // 读取 loans.json 文件
  let loans = [];
  try {
    const data = fs.readFileSync(path.join(dataDir, 'loans.json'), 'utf8');
    loans = JSON.parse(data);
  } catch (err) {
    console.error('Failed to read loans data:', err);
    return res.status(500).json({ error: '读取数据失败' });
  }

  // 查找对应的借贷记录
  const loan = loans.find(l => l.id === loanId);
  if (!loan) {
    return res.status(404).json({ error: '找不到借贷记录' });
  }

  // 确保 repayments 数组存在
  if (!loan.repayments) {
    loan.repayments = [];
  }
  
  // 查找并删除还款记录
  const repaymentIndex = loan.repayments.findIndex(r => r.id === repaymentId);
  if (repaymentIndex === -1) {
    return res.status(404).json({ error: '找不到还款记录' });
  }
  
  // 删除还款记录
  loan.repayments.splice(repaymentIndex, 1);
  
  // 重新计算是否已还清
  const totalRepaid = loan.repayments.reduce((sum, r) => sum + r.amount, 0);
  loan.is_repaid = totalRepaid >= loan.amount;
  
  // 保存更新后的数据
  try {
    fs.writeFileSync(path.join(dataDir, 'loans.json'), JSON.stringify(loans, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to save loans data:', err);
    res.status(500).json({ error: '保存数据失败' });
  }
});

module.exports = router;
