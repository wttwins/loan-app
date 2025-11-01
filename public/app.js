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
    this.isLoggedIn = false;
    this.init();
    this.addModalsToBody();
  }

  async init() {
    this.appContainer = document.getElementById('app');
    this.borrowers = [];
    this.loans = [];
    this.groupedLoans = {};
    this.expandedBorrowers = new Set();
    
    // 检查登录状态
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
      this.isLoggedIn = true;
      await this.fetchData();
    }
    
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
    if (!this.isLoggedIn) {
      this.renderLoginForm();
    } else {
      this.renderApp();
    }
  }

  renderLoginForm() {
    this.appContainer.innerHTML = `
      <div class="login-container">
        <div class="login-form">
          <h2>借贷管理系统</h2>
          <div class="form-group">
            <label>用户名</label>
            <div class="input-group">
              <i class="fas fa-user"></i>
              <input type="text" id="username" class="form-control" placeholder="请输入用户名">
            </div>
          </div>
          <div class="form-group">
            <label>密码</label>
            <div class="input-group">
              <i class="fas fa-lock"></i>
              <input type="password" id="password" class="form-control" placeholder="请输入密码">
            </div>
          </div>
          <button id="login-btn" class="btn-login">
            <i class="fas fa-sign-in-alt me-2"></i>
            登录
          </button>
        </div>
      </div>
    `;
  }

  renderApp() {
    this.appContainer.innerHTML = `
      <header>
        <h1>借贷管理系统</h1>
        <button id="logout-btn" class="btn-logout">退出登录</button>
      </header>

      <div class="stats">
        <div class="stat-item">
          <div class="label">总计应收</div>
          <div class="amount">¥${this.totalReceivable.outstanding.toFixed(2)}</div>
        </div>
        <div class="stat-item">
          <div class="label">总计应还</div>
          <div class="amount">¥${this.totalDebt.toFixed(2)}</div>
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
            ${this.renderBorrowerLoans({
              id: borrowerId,
              name: group.borrower_name,
              phone: group.borrower_phone
            }, group.loans)}
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
            <th>借贷金额</th>
            <th>已还金额</th>
            <th>剩余金额</th>
            <th>类型</th>
            <th>备注</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${loans.map(loan => {
            // 计算已还款总额
            const repaidAmount = (loan.repayments || []).reduce((sum, repayment) => 
              sum + repayment.amount, 0);
            // 计算剩余金额
            const remainingAmount = loan.amount - repaidAmount;
            
            return `
              <tr class="${loan.is_repaid ? 'repaid' : ''}" data-loan-id="${loan.id}">
                <td data-label="借贷时间">${new Date(loan.created_at).toLocaleString()}</td>
                <td data-label="借贷金额">${loan.amount.toFixed(2)} 元</td>
                <td data-label="已还金额" class="text-success">${repaidAmount.toFixed(2)} 元</td>
                <td data-label="剩余金额" class="text-danger">${remainingAmount.toFixed(2)} 元</td>
                <td data-label="类型">${loan.type}</td>
                <td data-label="备注">${loan.description || '无'}</td>
                <td data-label="状态">
                  <div class="d-flex gap-2">
                    <button class="repayment-btn ${loan.is_repaid ? 'repaid' : ''}" 
                            data-loan-id="${loan.id}"
                            style="background-color: ${loan.is_repaid ? '#4CAF50' : '#f44336'}; 
                                   color: white; 
                                   border: none; 
                                   padding: 5px 10px; 
                                   border-radius: 4px;
                                   cursor: pointer;">
                      ${loan.is_repaid ? '已还清' : (loan.type === '借出' ? '收债' : '还债')}
                    </button>
                    <button class="history-btn btn btn-info btn-sm"
                            data-loan-id="${loan.id}">
                      还款记录
                    </button>
                  </div>
                </td>
                <td data-label="操作">
                  <button class="delete-btn" 
                          data-loan-id="${loan.id}"
                          data-borrower-id="${loan.borrowerId}">
                    删除
                  </button>
                </td>
              </tr>
              <tr class="repayment-form-row" id="repayment-form-${loan.id}" style="display: none;">
                <td colspan="8">
                  <div class="card p-3 bg-light">
                    <h5 class="mb-3">部分还款</h5>
                    <div class="row mb-3">
                      <div class="col-md-4">
                        <label class="form-label">还款金额 (剩余未还：¥<span class="remaining-amount">0</span>)</label>
                        <input type="number" class="form-control repayment-amount" step="0.01" required>
                      </div>
                      <div class="col-md-4">
                        <label class="form-label">还款日期</label>
                        <input type="date" class="form-control repayment-date">
                      </div>
                      <div class="col-md-4">
                        <label class="form-label">备注</label>
                        <input type="text" class="form-control repayment-note" placeholder="可选">
                      </div>
                    </div>
                    <div class="repayment-actions-center">
                      <button class="btn btn-secondary cancel-repayment">取消</button>
                      <button class="btn btn-primary submit-repayment">确认还款</button>
                    </div>
                  </div>
                </td>
              </tr>
              <tr class="repayment-history-row" id="repayment-history-${loan.id}" style="display: none;">
                <td colspan="8">
                  <table class="table table-hover repayment-table">
                    <thead class="table-light">
                      <tr>
                        <th style="width: 200px" class="text-center">还款日期</th>
                        <th style="width: 200px" class="text-center">还款金额</th>
                        <th class="text-center">备注</th>
                        <th style="width: 100px" class="text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody class="repayment-records">
                      <!-- 还款记录将在这里动态插入 -->
                    </tbody>
                  </table>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  renderBorrowerLoans(borrower, loans) {
    const isExpanded = this.expandedBorrowers.has(borrower.id);
    
    // 计算总计金额，考虑部分还款
    const totalAmount = loans.reduce((sum, loan) => {
      // 计算已还款总额
      const repaidAmount = (loan.repayments || []).reduce((repaid, repayment) => 
        repaid + repayment.amount, 0);
      
      if (loan.type === '借出') {
        // 对于借出的记录，计算剩余未还金额（如果未还金额小于0，则返回0）
        const remaining = Math.max(0, loan.amount - repaidAmount);
        return sum + remaining;
      } else if (loan.type === '借入' && !loan.is_repaid) {
        // 对于借入的记录，计算剩余未还金额（如果未还金额小于0，则返回0）
        const remaining = Math.max(0, loan.amount - repaidAmount);
        return sum - remaining; // 注意这里是减去剩余金额
      }
      return sum;
    }, 0);

    return `
      <div class="loan-group">
        <div class="group-header" data-borrower-id="${borrower.id}" data-expanded="${isExpanded}">
          <div class="borrower-name">
            <i class="fas ${isExpanded ? 'fa-chevron-right' : 'fa-chevron-right'} toggle-icon"></i>
            ${borrower.name} ${borrower.phone ? `(${borrower.phone})` : ''}
          </div>
          <div class="total-amount" style="color: ${totalAmount >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
            总计：${Math.abs(totalAmount).toFixed(2)} 元
            ${totalAmount >= 0 ? '(应收)' : '(应付)'}
          </div>
        </div>
        ${isExpanded ? `
          <div class="group-content">
            ${this.renderLoanTable(loans)}
          </div>
        ` : ''}
      </div>
    `;
  }

  setupEventListeners() {
    if (!this.isLoggedIn) {
      // 登录表单事件监听
      document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
      // 添加回车键登录
      document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleLogin();
        }
      });
    } else {
      // 已登录状态的事件监听
      document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());
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
      document.querySelector('.loan-management')?.addEventListener('click', async (e) => {
        const target = e.target;
        
        // Handle repayment button click
        if (target.classList.contains('repayment-btn')) {
          const loanId = target.dataset.loanId;
          if (target.classList.contains('repaid')) {
            alert('该借贷已还清');
            return;
          }
          
          // 隐藏所有还款表单和还款记录
          document.querySelectorAll('.repayment-form-row, .repayment-history-row').forEach(row => {
            row.style.display = 'none';
          });

          // 显示当前还款表单
          const formRow = document.getElementById(`repayment-form-${loanId}`);
          if (formRow) {
            formRow.style.display = 'table-row';
            // 获取还款信息
            try {
              const response = await fetch(`/api/loans/${loanId}/repayments`);
              const data = await response.json();
              // 只更新剩余金额和最大可还金额
              formRow.querySelector('.remaining-amount').textContent = data.remaining.toFixed(2);
              const amountInput = formRow.querySelector('.repayment-amount');
              amountInput.max = data.remaining;
              amountInput.placeholder = `最大可还金额：${data.remaining.toFixed(2)}`;
              formRow.querySelector('.repayment-date').value = new Date().toISOString().split('T')[0];
            } catch (error) {
              console.error('获取还款信息失败:', error);
              alert('获取还款信息失败');
            }
          }
          return;
        }

        // Handle history button click
        if (target.classList.contains('history-btn')) {
          const loanId = target.dataset.loanId;
          const historyRow = document.getElementById(`repayment-history-${loanId}`);
          
          // 如果当前记录已显示，则隐藏
          if (historyRow.style.display === 'table-row') {
            historyRow.style.display = 'none';
            return;
          }

          // 隐藏所有还款表单和还款记录
          document.querySelectorAll('.repayment-form-row, .repayment-history-row').forEach(row => {
            row.style.display = 'none';
          });

          // 显示并加载当前还款记录
          await this.showRepaymentHistory(loanId);
        return;
      }
      
      // Handle delete operations
        if (target.classList.contains('delete-btn')) {
          const loanId = target.dataset.loanId;
        this.deleteLoan(loanId);
        return;
      }

        // Handle submit repayment
        if (target.classList.contains('submit-repayment')) {
          const formRow = target.closest('.repayment-form-row');
          const loanId = formRow.id.split('-').pop();
          const amount = formRow.querySelector('.repayment-amount').value;
          const repayment_date = formRow.querySelector('.repayment-date').value;
          const note = formRow.querySelector('.repayment-note').value;

          if (!amount || amount <= 0) {
            alert('请输入有效的还款金额');
            return;
          }

          try {
            const response = await fetch(`/api/loans/${loanId}/partial-repayment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ amount, repayment_date, note })
            });

            if (response.ok) {
              formRow.style.display = 'none';
              await this.fetchLoans();
              this.render();
              this.setupEventListeners();
              
              // 刷新还款记录的显示
              const historyRow = document.getElementById(`repayment-history-${loanId}`);
              if (historyRow && historyRow.style.display === 'table-row') {
                await this.showRepaymentHistory(loanId);
              }
              
              this.showToast('还款成功！');
            } else {
              const data = await response.json();
              throw new Error(data.error || '还款失败');
            }
          } catch (error) {
            console.error('还款失败:', error);
            alert(error.message || '还款失败');
          }
          return;
        }

        // Handle cancel repayment
        if (target.classList.contains('cancel-repayment')) {
          const formRow = target.closest('.repayment-form-row');
          formRow.style.display = 'none';
          return;
        }

        // Handle delete repayment
        if (target.classList.contains('delete-repayment')) {
          const loanId = target.dataset.loanId;
          const repaymentId = target.dataset.repaymentId;
          
          if (!confirm('确定要删除这条还款记录吗？')) {
            return;
          }

          try {
            const response = await fetch(`/api/loans/${loanId}/repayments/${repaymentId}`, {
              method: 'DELETE'
            });

            if (response.ok) {
              // 重新获取数据并更新显示
              await this.fetchLoans();
              this.render();
              this.setupEventListeners();
              
              // 重新显示还款记录
              await this.showRepaymentHistory(loanId);
              this.showToast('还款记录删除成功！');
            } else {
              throw new Error('删除还款记录失败');
            }
          } catch (error) {
            console.error('删除还款记录失败:', error);
            alert(error.message || '删除还款记录失败');
          }
          return;
        }
      });
    }
  }

  // 首先添加一个辅助方法来计算每个借贷人的净额
  calculateBorrowerNetAmount(borrowerId) {
    const loans = this.loans.filter(loan => loan.borrowerId === borrowerId);
    return loans.reduce((net, loan) => {
      // 计算已还款总额
      const repaidAmount = (loan.repayments || []).reduce((sum, repayment) => 
        sum + repayment.amount, 0);
      // 计算剩余未还金额
      const remaining = Math.max(0, loan.amount - repaidAmount);
      
      // 借出为正，借入为负
      if (loan.type === '借出' && !loan.is_repaid) {
        return net + remaining;
      } else if (loan.type === '借入' && !loan.is_repaid) {
        return net - remaining;
      }
      return net;
    }, 0);
  }

  // 修改 totalDebt 和 totalReceivable 的计算
  get totalDebt() {
    if (!this.loans || this.loans.length === 0) return 0;
    
    // 按借贷人分组计算净额
    const borrowerDebts = new Map();
    this.loans.forEach(loan => {
      if (!borrowerDebts.has(loan.borrowerId)) {
        borrowerDebts.set(loan.borrowerId, this.calculateBorrowerNetAmount(loan.borrowerId));
      }
    });

    // 只统计净额为负的部分（表示需要还款）
    const total = Array.from(borrowerDebts.values())
      .filter(amount => amount < 0)
      .reduce((total, amount) => total + Math.abs(amount), 0);
    
    // 处理精度问题，如果金额非常接近0，就返回0
    return Math.abs(total) < 0.01 ? 0 : total;
  }

  get totalReceivable() {
    // 按借贷人分组计算净额
    const borrowerReceivables = new Map();
    this.loans.forEach(loan => {
      if (!borrowerReceivables.has(loan.borrowerId)) {
        borrowerReceivables.set(loan.borrowerId, this.calculateBorrowerNetAmount(loan.borrowerId));
      }
    });

    // 只统计净额为正的部分（表示应收款）
    const total = Array.from(borrowerReceivables.values())
      .filter(amount => amount > 0)
      .reduce((total, amount) => total + amount, 0);
    
    const repaid = this.loans.reduce((sum, loan) => {
      if (loan.type === '借出' && loan.is_repaid) {
        return sum + loan.amount;
      }
      return sum;
    }, 0);
    
    const outstanding = Math.max(0, total - repaid);
    
    return {
      total: total,
      repaid: repaid,
      outstanding: outstanding
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
      this.expandedBorrowers.add(newLoan.borrowerId);
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

  async showRepaymentHistory(loanId) {
    try {
      const response = await fetch(`/api/loans/${loanId}/repayments`);
      const data = await response.json();
      
      const historyRow = document.getElementById(`repayment-history-${loanId}`);
      if (historyRow) {
        const historyHTML = data.repayments.map(repayment => `
          <tr>
            <td data-label="还款日期">
              <i class="far fa-calendar-alt me-2"></i>
              ${new Date(repayment.date).toLocaleDateString()}
            </td>
            <td data-label="还款金额" class="text-primary fw-bold">
              ¥${repayment.amount.toFixed(2)}
            </td>
            <td data-label="备注" class="text-muted">
              ${repayment.note || '-'}
            </td>
            <td data-label="操作">
              <button class="btn btn-danger btn-sm delete-repayment" 
                      data-loan-id="${loanId}" 
                      data-repayment-id="${repayment.id}">
                删除
              </button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">暂无还款记录</td></tr>';

        historyRow.querySelector('.repayment-records').innerHTML = historyHTML;
        historyRow.style.display = 'table-row';
      }
    } catch (error) {
      console.error('获取还款记录失败:', error);
      alert('获取还款记录失败');
    }
  }

  toggleGroup(borrowerId) {
    if (this.expandedBorrowers.has(borrowerId)) {
      this.expandedBorrowers.delete(borrowerId);
    } else {
      this.expandedBorrowers.add(borrowerId);
    }
    
    // Re-render the affected group
    this.render();
    this.setupEventListeners();
  }

  async handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
      alert('请输入用户名和密码');
      return;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        this.isLoggedIn = true;
        sessionStorage.setItem('isLoggedIn', 'true');
        await this.fetchData();
        this.render();
        this.setupEventListeners();
      } else {
        alert('用户名或密码错误');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('登录失败，请重试');
    }
  }

  handleLogout() {
    if (confirm('确定要退出登录吗？')) {
      this.isLoggedIn = false;
      sessionStorage.removeItem('isLoggedIn');
      this.render();
      this.setupEventListeners();
    }
  }

  // 添加模态框到页面

}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.loanApp = new LoanApp();
});