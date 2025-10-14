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
    const createdLoan = {
      id: Date.now(),
      amount: parseFloat(newLoan.amount),
      borrowerId: parseInt(newLoan.borrowerId),
      type: newLoan.type || '借出',
      description: newLoan.description || '',
      is_repaid: false,
      created_at: new Date().toISOString()
    };

    loans.push(createdLoan);
    fs.writeFileSync(path.join(dataDir, 'loans.json'), JSON.stringify(loans, null, 2));
    return res.status(201).json(createdLoan);
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

module.exports = router;
