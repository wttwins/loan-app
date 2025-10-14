class LoanApp {
  showToast(message, duration = 3000) {
    // Remove existing toast if any
    const existingToast = document.getElementById('app-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast element
    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#333';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '4px';
    toast.style.zIndex = '1000';
    toast.style.transition = 'opacity 0.3s ease';
    toast.textContent = message;

    // Add to DOM
    document.body.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  constructor() {
    this.init();
  }

  async init() {
    this.appContainer = document.getElementById('app');
    this.borrowers = [];
    this.loans = [];
    this.groupedLoans = {};
    this.expandedBorrowers = new Set();
    
    this.newBorrower = {
      name: '',
      phone: ''
    };
    
    this.newLoan = {
      borrowerId: null,
      datetime: new Date().toISOString().slice(0, 16),
      amount: 0,
      type: '借出',
      description: ''
    };

    await this.fetchData();
    this.render();
    this.setupEventListeners();
  }

  async fetchData() {
    await this.fetchBorrowers();
    await this.fetchLoans();
  }

  async fetchBorrowers() {
    try {
      const response = await fetch('/api/borrowers');
      this.borrowers = await response.json();
    } catch (error) {
      console.error('Error fetching borrowers:', error);
      this.borrowers = [];
    }
  }

  async fetchLoans() {
    try {
      const response = await fetch('/api/loans');
      const loans = await response.json();
      
      // Create a map of borrowers for quick lookup
      const borrowerMap = new Map(this.borrowers.map(b => [b.id, b]));
      
      this.loans = loans.map(loan => {
        const borrower = borrowerMap.get(loan.borrowerId);
        if (!borrower) {
          console.error(`找不到借贷人ID: ${loan.borrowerId}`);
          return {
            ...loan,
            borrower_name: '未知借贷人',
            created_at: loan.created_at,
            type: loan.type || '借出',
            description: loan.description || '',
            is_repaid: loan.is_repaid || false,
            is_invalid: true // Mark invalid loans
          };
        }
        return {
          ...loan,
          borrower_name: borrower.name,
          created_at: loan.created_at,
          type: loan.type || '借出',
          description: loan.description || '',
          is_repaid: loan.is_repaid || false,
          is_invalid: false
        };
      });
      
      // Show warning if any invalid loans exist
      const invalidLoans = this.loans.filter(loan => loan.is_invalid);
      if (invalidLoans.length > 0) {
        alert(`警告：发现${invalidLoans.length}条无效借贷记录（找不到对应借贷人）`);
      }
      
      this.groupLoans();
    } catch (error) {
      console.error('Error fetching loans:', error);
      this.loans = [];
    }
  }

  groupLoans() {
    this.groupedLoans = {};
    console.log('Grouping loans:', this.loans); // 调试日志
    
    this.loans.forEach(loan => {
      if (!loan || !loan.borrowerId) {
        console.warn('Invalid loan:', loan);
        return;
      }
      
      if (!this.groupedLoans[loan.borrowerId]) {
        this.groupedLoans[loan.borrowerId] = {
          borrower_name: loan.borrower_name,
          loans: [],
          total: 0
        };
      }
      
      // 确保金额是数字
      const amount = parseFloat(loan.amount);
      if (isNaN(amount)) {
        console.error('Invalid loan amount:', loan.amount);
        return;
      }
      
      // 更新分组数据
      this.groupedLoans[loan.borrowerId].loans.push(loan);
      // 只计算未还的记录
      if (!loan.is_repaid) {
        this.groupedLoans[loan.borrowerId].total += 
          loan.type === '借入' ? amount : -amount;
      }
        
      // 按时间排序
      this.groupedLoans[loan.borrowerId].loans.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
    });
    
    console.log('Grouped loans:', this.groupedLoans); // 调试日志
  }

  render() {
    this.appContainer.innerHTML = `
      <header>
        <h1>借贷管理系统</h1>
      </header>

      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">应还</span>
          <span class="stat-value">${this.totalDebt} 元</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">应收</span>
          <span class="stat-value">${this.totalReceivable.outstanding} 元</span>
        </div>
      </div>

      <main>
        ${this.renderBorrowerManagement()}
        ${this.renderLoanManagement()}
      </main>
    `;
  }

  renderBorrowerManagement() {
    return `
      <section class="borrower-management">
        <h2>借贷人管理</h2>
        <div class="add-borrower">
          <input type="text" id="borrower-name" placeholder="姓名" value="${this.newBorrower.name}">
          <input type="text" id="borrower-phone" placeholder="电话" value="${this.newBorrower.phone}">
          <button id="add-borrower-btn">添加借贷人</button>
        </div>
        <table class="borrower-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>电话</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${this.borrowers.map(borrower => `
              <tr>
                <td>${borrower.name}</td>
                <td>${borrower.phone}</td>
                <td>
                  <button class="delete-btn" data-borrower-id="${borrower.id}">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  renderLoanManagement() {
    return `
      <section class="loan-management">
        <h2>借贷记录</h2>
        <div class="add-loan">
          ${this.renderLoanForm()}
        </div>
        <div class="loan-groups">
          ${Object.entries(this.groupedLoans).map(([borrowerId, group]) => `
            <div class="loan-group">
              <div class="group-header" data-borrower-id="${borrowerId}">
                <span class="borrower-name">
                  <i class="fas fa-user-circle"></i>
                  ${group.borrower_name}
                </span>
                <span class="total-amount">
                  总计：${group.total > 0 ? `应还 ${group.total} 元` : `应收 ${-group.total} 元`}
                </span>
                <span class="toggle-icon">${this.expandedBorrowers.has(borrowerId) ? '▲' : '▼'}</span>
              </div>
              <div class="loan-group-content" style="display: ${this.expandedBorrowers.has(borrowerId) ? 'block' : 'none'}">
                ${this.renderLoanTable(group.loans)}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderLoanForm() {
    return `
      <div class="form-group">
        <label for="loan-borrower">借贷人</label>
        <select id="loan-borrower" required>
          <option value="">请选择</option>
          ${this.borrowers.map(borrower => `
            <option value="${borrower.id}">${borrower.name}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>借贷时间</label>
        <input type="datetime-local" id="loan-datetime" value="${this.newLoan.datetime}" required>
      </div>
      <div class="form-group">
        <label>金额</label>
        <input type="number" id="loan-amount" value="${this.newLoan.amount}" placeholder="金额" required>
      </div>
      <div class="form-group">
        <label>类型</label>
        <select id="loan-type" required>
          <option value="借出">借出</option>
          <option value="借入">借入</option>
        </select>
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="loan-description" placeholder="备注信息" rows="3">${this.newLoan.description}</textarea>
      </div>
      <button id="add-loan-btn">添加借贷记录</button>
    `;
  }

  renderLoanTable(loans) {
    return `
      <table class="loan-list">
        <thead>
          <tr>
            <th>借贷时间</th>
            <th>金额</th>
            <th>类型</th>
            <th>备注</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${loans.map(loan => `
            <tr class="${loan.is_repaid ? 'repaid' : ''}">
              <td>${new Date(loan.created_at).toLocaleString()}</td>
              <td>${loan.amount.toFixed(2)} 元</td>
              <td>${loan.type}</td>
              <td>${loan.description || '无'}</td>
              <td>
                <button class="status-btn ${loan.is_repaid ? 'repaid' : ''}" 
                        data-loan-id="${loan.id}"
                        style="background-color: ${loan.is_repaid ? '#4CAF50' : '#f44336'}; 
                               color: white; 
                               border: none; 
                               padding: 5px 10px; 
                               border-radius: 4px;
                               cursor: pointer;">
                  ${loan.is_repaid ? '已还' : '未还'}
                </button>
              </td>
              <td>
                <button class="delete-btn" 
                        data-loan-id="${loan.id}"
                        data-borrower-id="${loan.borrowerId}">
                  删除
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  setupEventListeners() {
    // Add borrower
    document.getElementById('add-borrower-btn')?.addEventListener('click', () => this.addBorrower());

    // Delete borrower
    document.querySelectorAll('.borrower-table .delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const borrowerId = e.target.dataset.borrowerId;
        this.deleteBorrower(borrowerId);
      });
    });

    // Add loan
    document.getElementById('add-loan-btn')?.addEventListener('click', () => this.addLoan());

    // Toggle loan group
    document.querySelectorAll('.loan-group .group-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const borrowerId = e.currentTarget.dataset.borrowerId;
        this.toggleGroup(borrowerId);
      });
    });

    // Handle loan operations using event delegation
    document.querySelector('.loan-management')?.addEventListener('click', (e) => {
      // Handle status toggles
      if (e.target.classList.contains('status-btn')) {
        const loanId = e.target.dataset.loanId;
        this.toggleRepaidStatus(loanId);
        return;
      }
      
      // Handle delete operations
      if (e.target.classList.contains('delete-btn')) {
        const loanId = e.target.dataset.loanId;
        this.deleteLoan(loanId);
        return;
      }
    });
  }

  get totalDebt() {
    if (!this.loans || this.loans.length === 0) return 0;
    return this.loans.reduce((sum, loan) => {
      return loan.type === '借入' && !loan.is_repaid ? sum + loan.amount : sum;
    }, 0);
  }

  get totalReceivable() {
    const total = this.loans.reduce((sum, loan) => {
      return loan.type === '借出' ? sum + loan.amount : sum;
    }, 0);
    
    const repaid = this.loans.reduce((sum, loan) => {
      return loan.type === '借出' && loan.is_repaid ? sum + loan.amount : sum;
    }, 0);
    
    return {
      total: total,
      repaid: repaid,
      outstanding: total - repaid
    };
  }

  async addBorrower() {
    const name = document.getElementById('borrower-name').value.trim();
    const phone = document.getElementById('borrower-phone').value.trim();

    if (!name) {
      alert('姓名不能为空');
      return;
    }

    try {
      const response = await fetch('/api/borrowers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone })
      });
      
      if (response.ok) {
        document.getElementById('borrower-name').value = '';
        document.getElementById('borrower-phone').value = '';
        // 立即获取最新数据并重新渲染
        await this.fetchBorrowers();
        await this.fetchLoans(); // 同时更新借贷记录
        this.render();
        this.setupEventListeners(); // 重新绑定事件
        alert('添加借款人成功');
      } else {
        alert('添加借款人失败');
      }
    } catch (error) {
      console.error('Error adding borrower:', error);
      alert('添加借款人失败');
    }
  }

  async deleteBorrower(borrowerId) {
    try {
      // Check if borrower has any loans
      const borrowerLoans = this.loans.filter(loan => loan.borrowerId === borrowerId);
      
      if (borrowerLoans.length > 0) {
        const totalAmount = borrowerLoans.reduce((sum, loan) => sum + loan.amount, 0);
        alert(`该借贷人存在${borrowerLoans.length}条借贷记录，总计金额${totalAmount}元，无法删除`);
        return;
      }

      if (!confirm('确定要删除该借贷人吗？')) return;

      const response = await fetch(`/api/borrowers/${borrowerId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '尚有借贷，不可删除借款人！');
      }

      await this.fetchBorrowers();
      await this.fetchLoans(); // 同时更新借贷记录
      this.render();
      this.setupEventListeners(); // 重新绑定事件
      alert('删除借款人成功');
    } catch (error) {
      console.error('Error deleting borrower:', error);
      alert(error.message || '尚有借贷，不可删除！');
    }
  }

  async addLoan() {
    const borrowerId = document.getElementById('loan-borrower').value;
    const datetime = document.getElementById('loan-datetime').value;
    const amount = parseFloat(document.getElementById('loan-amount').value);
    const type = document.getElementById('loan-type').value;
    const description = document.getElementById('loan-description').value.trim();

    if (!borrowerId) {
      alert('请选择借贷人');
      return;
    }
    if (amount <= 0) {
      alert('金额必须大于0');
      return;
    }
    if (!type) {
      alert('请选择借贷类型');
      return;
    }

    try {
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          borrowerId: borrowerId,
          amount: amount,
          type: type,
          description: description
        })
      });
      
      if (!response.ok) {
        throw new Error('添加借贷记录失败');
      }

      const newLoan = await response.json();
      console.log('API Response:', newLoan); // 调试日志

      // 重新获取最新数据以确保同步
      await this.fetchLoans();

      // 强制重新渲染
      if (newLoan && typeof newLoan.borrowerId !== 'undefined') {
        this.expandedBorrowers.add(String(newLoan.borrowerId));
      }
      this.render();
      this.setupEventListeners();
      
      // 更新借贷人选择框
      const borrowerSelect = document.getElementById('loan-borrower');
      if (borrowerSelect) {
        borrowerSelect.value = '';
      }
      
      // 重置表单
      document.getElementById('loan-borrower').value = '';
      document.getElementById('loan-datetime').value = new Date().toISOString().slice(0, 16);
      document.getElementById('loan-amount').value = '';
      document.getElementById('loan-type').value = '借出';
      document.getElementById('loan-description').value = '';
      
      this.showToast('借贷记录添加成功');
    } catch (error) {
      console.error('Error adding loan:', error);
      alert(error.message);
    }
  }

  async deleteLoan(loanId) {
    if (!confirm('确定要删除这条借贷记录吗？')) return;
    
    try {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.fetchLoans();
        this.render();
        this.setupEventListeners();
        alert('删除成功');
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
      alert(error.message);
    }
  }

  async toggleRepaidStatus(loanId) {
    if (!confirm('确定要更改还款状态吗？')) return;
    
    try {
      const response = await fetch(`/api/loans/${loanId}/toggle-repaid`, {
        method: 'PATCH'
      });

      if (response.ok) {
        // 重新获取最新数据以确保状态同步
        await this.fetchLoans();
        this.render();
        this.setupEventListeners();
        this.showToast('状态更新成功');
      } else {
        throw new Error('更新状态失败');
      }
    } catch (error) {
      console.error('Error toggling repaid status:', error);
      alert(error.message);
    }
  }

  toggleGroup(borrowerId) {
    if (this.expandedBorrowers.has(borrowerId)) {
      this.expandedBorrowers.delete(borrowerId);
    } else {
      this.expandedBorrowers.add(borrowerId);
    }
    
    // 重新渲染整个界面以反映最新的展开状态
    this.render();
    this.setupEventListeners();
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new LoanApp();
});
