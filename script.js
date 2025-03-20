// Dados mockados para demonstração
let mockUsers = [{
    email: 'admin@example.com',
    password: 'admin123',
    isAdmin: true,
    active: true
}];

let currentUser = null;
let expenses = [];
let selectedExpenses = new Set();
let closures = []; // Adicionar array de fechamentos

// Variável para armazenar o intervalo de atualização
let adminUpdateInterval;

// Elementos do DOM
const loginScreen = document.getElementById('loginScreen');
const userScreen = document.getElementById('userScreen');
const adminScreen = document.getElementById('adminScreen');
const loginForm = document.getElementById('loginForm');
const expenseForm = document.getElementById('expenseForm');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const userExpensesList = document.getElementById('userExpensesList');
const adminExpensesList = document.getElementById('adminExpensesList');
const filterStatus = document.getElementById('filterStatus');
const filterUser = document.getElementById('filterUser');

// Elementos adicionais do DOM
const startCameraBtn = document.getElementById('startCamera');
const captureImageBtn = document.getElementById('captureImage');
const retakeImageBtn = document.getElementById('retakeImage');
const camera = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const cameraPreview = document.getElementById('camera-preview');
const ocrStatus = document.querySelector('.ocr-status');
const progressBar = document.querySelector('.progress');
const selectedExpensesList = document.getElementById('selectedExpensesList');
const totalAmountElement = document.getElementById('totalAmount');
const reimbursementDate = document.getElementById('reimbursementDate');
const createReimbursementBtn = document.getElementById('createReimbursement');

let stream = null;
let capturedImage = null;

// Event Listeners
loginForm.addEventListener('submit', handleLogin);
expenseForm.addEventListener('submit', handleExpenseSubmit);
btnLogout.addEventListener('click', handleLogout);
filterStatus.addEventListener('change', filterExpenses);
filterUser.addEventListener('change', filterExpenses);

// Event Listeners adicionais
startCameraBtn.addEventListener('click', startCamera);
captureImageBtn.addEventListener('click', captureImage);
retakeImageBtn.addEventListener('click', retakeImage);
createReimbursementBtn.addEventListener('click', createReimbursement);

// Funções de Autenticação
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const user = mockUsers.find(u => u.email === email && u.password === password && u.active);
    
    if (user) {
        currentUser = user;
        updateUI();
        loadExpenses();
        
        // Inicializar navegação se for admin
        if (user.isAdmin) {
            initializeAdminNav();
            startAdminAutoUpdate();
            loadUsers(); // Carregar lista de usuários
        }
    } else {
        alert('Email ou senha inválidos ou usuário inativo!');
    }
}

function handleLogout() {
    // Parar atualização automática ao fazer logout
    if (adminUpdateInterval) {
        clearInterval(adminUpdateInterval);
        adminUpdateInterval = null;
    }
    currentUser = null;
    updateUI();
}

function updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdateTime');
    if (lastUpdateElement) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR');
        lastUpdateElement.textContent = timeStr;
    }
}

function forceUpdate() {
    if (currentUser && currentUser.isAdmin) {
        loadSavedExpenses();
        loadAdminExpenses();
        loadClosures();
        updateLastUpdateTime();
    }
}

function startAdminAutoUpdate() {
    // Parar intervalo anterior se existir
    if (adminUpdateInterval) {
        clearInterval(adminUpdateInterval);
    }
    
    // Atualizar timestamp inicial
    updateLastUpdateTime();
    
    // Atualizar a cada 30 segundos
    adminUpdateInterval = setInterval(() => {
        if (currentUser && currentUser.isAdmin) {
            console.log('Atualizando dados do admin...'); // Debug
            loadSavedExpenses();
            loadAdminExpenses();
            loadClosures();
            updateLastUpdateTime();
        }
    }, 30000); // 30 segundos
}

// Funções de UI
function updateUI() {
    loginScreen.style.display = currentUser ? 'none' : 'block';
    userScreen.style.display = currentUser && !currentUser.isAdmin ? 'block' : 'none';
    adminScreen.style.display = currentUser && currentUser.isAdmin ? 'block' : 'none';
    btnLogin.style.display = currentUser ? 'none' : 'block';
    btnLogout.style.display = currentUser ? 'block' : 'none';
}

// Funções de Despesas
function handleExpenseSubmit(e) {
    e.preventDefault();
    
    let receiptFile = document.getElementById('receipt').files[0];
    
    // Se tiver uma imagem capturada, converter para File
    if (capturedImage) {
        const base64Data = capturedImage.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
            const slice = byteCharacters.slice(offset, offset + 1024);
            const byteNumbers = new Array(slice.length);
            
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        
        receiptFile = new File(byteArrays, 'recibo.jpg', { type: 'image/jpeg' });
    }
    
    const expense = {
        id: Date.now().toString(), // Converter ID para string
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        observation: document.getElementById('observation').value,
        status: 'pendente',
        userId: currentUser.email,
        receipt: receiptFile
    };

    expenses.push(expense);
    saveExpenses();
    loadExpenses();
    expenseForm.reset();
    
    // Limpar câmera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    cameraPreview.innerHTML = '';
    startCameraBtn.style.display = 'block';
    captureImageBtn.style.display = 'none';
    retakeImageBtn.style.display = 'none';
}

function loadExpenses() {
    if (currentUser.isAdmin) {
        loadAdminExpenses();
    } else {
        loadUserExpenses();
    }
}

function loadUserExpenses() {
    const userExpenses = expenses.filter(e => e.userId === currentUser.email);
    userExpensesList.innerHTML = userExpenses.map(expense => createExpenseCard(expense)).join('');
}

function loadAdminExpenses() {
    // Ordenar despesas: pendentes primeiro, depois por data (mais recentes)
    const sortedExpenses = [...expenses].sort((a, b) => {
        if (a.status === 'pendente' && b.status !== 'pendente') return -1;
        if (a.status !== 'pendente' && b.status === 'pendente') return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    adminExpensesList.innerHTML = sortedExpenses.map(expense => createAdminExpenseCard(expense)).join('');
    updateSelectedExpensesList();
    
    // Atualizar timestamp
    if (currentUser && currentUser.isAdmin) {
        updateLastUpdateTime();
    }
}

function createExpenseCard(expense) {
    return `
        <div class="expense-card ${expense.status}">
            <div>
                <h4>${expense.description}</h4>
                <p>Valor: R$ ${expense.amount.toFixed(2)}</p>
                <p>Categoria: ${expense.category}</p>
                <p>Data: ${new Date(expense.date).toLocaleDateString()}</p>
                <p>Status: ${expense.status}</p>
                ${expense.observation ? `<p class="observation">Observação: ${expense.observation}</p>` : ''}
            </div>
        </div>
    `;
}

function createAdminExpenseCard(expense) {
    const isSelected = selectedExpenses.has(expense.id);
    
    return `
        <div class="expense-card ${expense.status}" data-expense-id="${expense.id}">
            <div>
                <h4>${expense.description}</h4>
                <p>Valor: R$ ${expense.amount.toFixed(2)}</p>
                <p>Categoria: ${expense.category}</p>
                <p>Data: ${new Date(expense.date).toLocaleDateString()}</p>
                <p>Usuário: ${expense.userId}</p>
                <p>Status: ${expense.status}</p>
                ${expense.observation ? `<p class="observation">Observação: ${expense.observation}</p>` : ''}
                ${expense.receipt ? `
                    <div class="receipt-container">
                        <p>Recibo:</p>
                        <button class="view-receipt-btn" onclick="viewReceipt('${expense.id}')">
                            Visualizar Recibo
                        </button>
                    </div>
                ` : '<p>Nenhum recibo anexado</p>'}
            </div>
            <div class="expense-actions">
                ${expense.status === 'pendente' ? `
                    <button class="approve-btn" onclick="updateExpenseStatus('${expense.id}', 'aprovado')">
                        Aprovar
                    </button>
                    <button class="reject-btn" onclick="updateExpenseStatus('${expense.id}', 'rejeitado')">
                        Rejeitar
                    </button>
                ` : ''}
                ${expense.status === 'aprovado' ? `
                    <button class="select-expense-btn ${isSelected ? 'selected' : ''}" 
                            onclick="toggleExpenseSelection('${expense.id}')">
                        ${isSelected ? 'Remover' : 'Selecionar'}
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function updateExpenseStatus(expenseId, status) {
    console.log('Atualizando status:', expenseId, status); // Debug
    
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) {
        console.log('Despesa não encontrada:', expenseId); // Debug
        return;
    }

    expense.status = status;
    saveExpenses();
    
    // Atualizar a interface
    const expenseCard = document.querySelector(`[data-expense-id="${expenseId}"]`);
    if (expenseCard) {
        expenseCard.className = `expense-card ${status}`;
        // Recriar o card para atualizar os botões
        expenseCard.outerHTML = createAdminExpenseCard(expense);
    }
    
    // Recarregar a lista completa para manter a ordem correta
    loadAdminExpenses();
}

function filterExpenses() {
    const status = filterStatus.value;
    const user = filterUser.value;
    
    let filteredExpenses = expenses;
    
    if (status !== 'todos') {
        filteredExpenses = filteredExpenses.filter(e => e.status === status);
    }
    
    if (user !== 'todos') {
        filteredExpenses = filteredExpenses.filter(e => e.userId === user);
    }
    
    adminExpensesList.innerHTML = filteredExpenses.map(expense => createAdminExpenseCard(expense)).join('');
}

// Persistência de Dados
function saveExpenses() {
    // Criar cópia das despesas sem os objetos File
    const expensesToSave = expenses.map(expense => {
        const expenseCopy = { ...expense };
        if (expense.receipt) {
            // Salvar apenas o nome e tipo do arquivo
            expenseCopy.receipt = {
                name: expense.receipt.name,
                type: expense.receipt.type
            };
            
            // Salvar o conteúdo do arquivo separadamente
            if (expense.receipt instanceof File) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    localStorage.setItem(`receipt_${expense.id}`, e.target.result);
                };
                reader.readAsDataURL(expense.receipt);
            }
        }
        return expenseCopy;
    });

    // Salvar despesas e fechamentos
    localStorage.setItem('expenses', JSON.stringify(expensesToSave));
    
    // Salvar fechamentos com cópia dos recibos
    const closuresToSave = closures.map(closure => ({
        ...closure,
        expenses: closure.expenses.map(expense => ({
            ...expense,
            receipt: expense.receipt ? {
                name: expense.receipt.name,
                type: expense.receipt.type
            } : null
        }))
    }));
    localStorage.setItem('closures', JSON.stringify(closuresToSave));
    
    console.log('Dados salvos com sucesso'); // Debug
}

function loadSavedExpenses() {
    const savedExpenses = localStorage.getItem('expenses');
    const savedClosures = localStorage.getItem('closures');
    
    if (savedExpenses) {
        expenses = JSON.parse(savedExpenses);
        // Restaurar os recibos
        expenses.forEach(expense => {
            if (expense.receipt) {
                const receiptData = localStorage.getItem(`receipt_${expense.id}`);
                if (receiptData) {
                    // Converter o Data URL de volta para um objeto File
                    const arr = receiptData.split(',');
                    const mime = arr[0].match(/:(.*?);/)[1];
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    expense.receipt = new File([u8arr], expense.receipt.name, { type: expense.receipt.type });
                }
            }
        });
    }
    
    if (savedClosures) {
        closures = JSON.parse(savedClosures);
    }
}

// Inicialização
loadSavedExpenses();
updateUI();

// Adicionar função para visualizar recibo
function viewReceipt(expenseId) {
    console.log('Visualizando recibo da despesa:', expenseId); // Debug
    
    // Primeiro, tentar encontrar a despesa no array principal
    let expense = expenses.find(e => e.id === expenseId);
    
    // Se não encontrar no array principal, procurar nos fechamentos
    if (!expense) {
        for (const closure of closures) {
            expense = closure.expenses.find(e => e.id === expenseId);
            if (expense) break;
        }
    }

    if (!expense) {
        console.log('Despesa não encontrada:', expenseId); // Debug
        alert('Despesa não encontrada.');
        return;
    }

    if (!expense.receipt) {
        console.log('Recibo não encontrado para a despesa:', expenseId); // Debug
        alert('Recibo não encontrado.');
        return;
    }

    // Recuperar o conteúdo do recibo do localStorage
    const receiptData = localStorage.getItem(`receipt_${expenseId}`);
    if (!receiptData) {
        console.log('Conteúdo do recibo não encontrado no localStorage:', expenseId); // Debug
        alert('Conteúdo do recibo não encontrado.');
        return;
    }

    // Criar modal para exibir o recibo
    const modal = document.createElement('div');
    modal.className = 'receipt-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>Recibo - ${expense.description}</h3>
            ${expense.receipt.type.startsWith('image/') 
                ? `<img src="${receiptData}" alt="Recibo" style="max-width: 100%;">`
                : `<iframe src="${receiptData}" style="width: 100%; height: 500px;"></iframe>`
            }
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar modal
    modal.querySelector('.close-modal').onclick = function() {
        modal.remove();
    };
    
    // Fechar modal ao clicar fora
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

// Funções da Câmera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        camera.srcObject = stream;
        camera.style.display = 'block';
        startCameraBtn.style.display = 'none';
        captureImageBtn.style.display = 'block';
    } catch (err) {
        alert('Erro ao acessar a câmera: ' + err.message);
    }
}

function captureImage() {
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    canvas.getContext('2d').drawImage(camera, 0, 0);
    
    capturedImage = canvas.toDataURL('image/jpeg');
    cameraPreview.innerHTML = `<img src="${capturedImage}" alt="Imagem capturada">`;
    
    camera.style.display = 'none';
    captureImageBtn.style.display = 'none';
    retakeImageBtn.style.display = 'block';
    
    // Iniciar OCR na imagem capturada
    processImageWithOCR(capturedImage);
}

function retakeImage() {
    cameraPreview.innerHTML = '';
    camera.style.display = 'block';
    captureImageBtn.style.display = 'block';
    retakeImageBtn.style.display = 'none';
    capturedImage = null;
}

// Funções de OCR
async function processImageWithOCR(imageData) {
    ocrStatus.style.display = 'block';
    progressBar.style.width = '0%';
    
    try {
        const result = await Tesseract.recognize(
            imageData,
            'por',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressBar.style.width = `${m.progress * 100}%`;
                    }
                }
            }
        );
        
        const text = result.data.text;
        extractExpenseData(text);
    } catch (err) {
        console.error('Erro no OCR:', err);
        alert('Erro ao processar a imagem. Tente novamente.');
    } finally {
        ocrStatus.style.display = 'none';
    }
}

function extractExpenseData(text) {
    // Padrões para extrair informações
    const patterns = {
        amount: /R\$\s*(\d+[.,]\d{2})/i,
        date: /(\d{2}\/\d{2}\/\d{4})/i,
        description: /(?:TOTAL|VALOR|PAGAMENTO|RECIBO)\s*:?\s*([^\n]+)/i
    };
    
    // Extrair valor
    const amountMatch = text.match(patterns.amount);
    if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(',', '.'));
        document.getElementById('amount').value = amount.toFixed(2);
    }
    
    // Extrair data
    const dateMatch = text.match(patterns.date);
    if (dateMatch) {
        const [day, month, year] = dateMatch[1].split('/');
        document.getElementById('date').value = `${year}-${month}-${day}`;
    }
    
    // Extrair descrição
    const descriptionMatch = text.match(patterns.description);
    if (descriptionMatch) {
        document.getElementById('description').value = descriptionMatch[1].trim();
    }
}

function toggleExpenseSelection(expenseId) {
    if (selectedExpenses.has(expenseId)) {
        selectedExpenses.delete(expenseId);
    } else {
        selectedExpenses.add(expenseId);
    }
    updateSelectedExpensesList();
    loadAdminExpenses(); // Recarrega para atualizar os botões
}

function updateSelectedExpensesList() {
    const selectedExpensesArray = Array.from(selectedExpenses).map(id => 
        expenses.find(e => e.id === id)
    );
    
    selectedExpensesList.innerHTML = selectedExpensesArray.map(expense => `
        <div class="selected-expense-item">
            <div>
                <strong>${expense.description}</strong>
                <p>R$ ${expense.amount.toFixed(2)}</p>
            </div>
            <button class="remove-expense-btn" onclick="toggleExpenseSelection('${expense.id}')">
                Remover
            </button>
        </div>
    `).join('');
    
    const total = selectedExpensesArray.reduce((sum, expense) => sum + expense.amount, 0);
    totalAmountElement.textContent = total.toFixed(2);
    
    // Habilitar/desabilitar botão de criar reembolso
    createReimbursementBtn.disabled = selectedExpensesArray.length === 0 || !reimbursementDate.value;
}

function createReimbursement() {
    if (!reimbursementDate.value) {
        alert('Por favor, selecione uma data para o reembolso.');
        return;
    }
    
    const selectedExpensesArray = Array.from(selectedExpenses).map(id => {
        const expense = expenses.find(e => e.id === id);
        // Criar uma cópia completa da despesa
        return {
            ...expense,
            receipt: expense.receipt ? {
                name: expense.receipt.name,
                type: expense.receipt.type
            } : null
        };
    });
    
    // Pegar o usuário da primeira despesa selecionada
    const user = selectedExpensesArray[0]?.userId || 'N/A';
    
    const closure = {
        id: Date.now().toString(),
        date: reimbursementDate.value,
        expenses: selectedExpensesArray,
        total: selectedExpensesArray.reduce((sum, expense) => sum + expense.amount, 0),
        status: 'fechado',
        userId: user
    };
    
    // Adicionar o fechamento ao array
    closures.push(closure);
    
    // Marcar despesas como reembolsadas
    selectedExpensesArray.forEach(expense => {
        const originalExpense = expenses.find(e => e.id === expense.id);
        if (originalExpense) {
            originalExpense.status = 'reembolsado';
        }
    });
    
    // Salvar alterações
    saveExpenses();
    
    // Limpar seleção
    selectedExpenses.clear();
    reimbursementDate.value = '';
    updateSelectedExpensesList();
    loadAdminExpenses();
    
    // Atualizar relatório
    loadClosures();
    
    alert(`Fechamento criado com sucesso!\nTotal: R$ ${closure.total.toFixed(2)}`);
}

// Adicionar listener para data do reembolso
reimbursementDate.addEventListener('change', updateSelectedExpensesList);

// Função auxiliar para formatar data
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Funções para o relatório de fechamentos
function initializeReports() {
    const filterBtn = document.getElementById('filterReports');
    const exportExcelBtn = document.getElementById('exportExcel');
    const exportPdfBtn = document.getElementById('exportPDF');

    if (filterBtn) {
        filterBtn.addEventListener('click', filterReports);
    }
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPDF);
    }

    // Carregar fechamentos ao inicializar
    loadClosures();
}

function loadClosures() {
    // Ordenar fechamentos por data (mais recentes primeiro)
    const sortedClosures = [...closures].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    console.log('Fechamentos carregados:', sortedClosures); // Debug
    updateReportsSummary(sortedClosures);
    updateReportsTable(sortedClosures);
}

function updateReportsSummary(closures) {
    const totalClosures = closures.length;
    const totalValue = closures.reduce((sum, closure) => sum + closure.total, 0);
    const averageValue = totalClosures > 0 ? totalValue / totalClosures : 0;

    const totalClosuresElement = document.querySelector('.total-closures');
    const totalValueElement = document.querySelector('.total-value');
    const averageValueElement = document.querySelector('.average-value');

    if (totalClosuresElement) totalClosuresElement.textContent = totalClosures;
    if (totalValueElement) totalValueElement.textContent = `R$ ${totalValue.toFixed(2)}`;
    if (averageValueElement) averageValueElement.textContent = `R$ ${averageValue.toFixed(2)}`;
    
    console.log('Resumo atualizado:', { totalClosures, totalValue, averageValue }); // Debug
}

function updateReportsTable(closures) {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    closures.forEach(closure => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(closure.date)}</td>
            <td>${closure.id}</td>
            <td>${closure.userId}</td>
            <td>R$ ${closure.total.toFixed(2)}</td>
            <td>${closure.expenses.length}</td>
            <td>
                <button class="view-details-btn" onclick="viewClosureDetails('${closure.id}')">
                    Ver Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function viewClosureDetails(closureId) {
    const closure = closures.find(c => c.id === closureId);
    if (!closure) return;

    const detailsHtml = `
        <div class="closure-details">
            <h3>Detalhes do Fechamento #${closure.id}</h3>
            <p><strong>Data:</strong> ${formatDate(closure.date)}</p>
            <p><strong>Usuário:</strong> ${closure.userId}</p>
            <p><strong>Total:</strong> R$ ${closure.total.toFixed(2)}</p>
            <p><strong>Número de Despesas:</strong> ${closure.expenses.length}</p>
            <h4>Despesas:</h4>
            <table class="details-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Categoria</th>
                        <th>Usuário</th>
                        <th>Anexo</th>
                    </tr>
                </thead>
                <tbody>
                    ${closure.expenses.map(expense => `
                        <tr>
                            <td>${formatDate(expense.date)}</td>
                            <td>${expense.description}</td>
                            <td>R$ ${expense.amount.toFixed(2)}</td>
                            <td>${expense.category}</td>
                            <td>${expense.userId}</td>
                            <td>
                                ${expense.receipt ? `
                                    <button class="view-receipt-btn" onclick="viewReceiptFromClosure('${expense.id}')">
                                        Ver Anexo
                                    </button>
                                ` : 'Sem anexo'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            ${detailsHtml}
            <button class="close-modal-btn" onclick="this.parentElement.parentElement.remove()">
                Fechar
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function viewReceiptFromClosure(expenseId) {
    // Primeiro, tentar encontrar a despesa no array de despesas
    let expense = expenses.find(e => e.id === expenseId);
    
    // Se não encontrar no array principal, procurar nos fechamentos
    if (!expense) {
        for (const closure of closures) {
            expense = closure.expenses.find(e => e.id === expenseId);
            if (expense) break;
        }
    }

    if (!expense) {
        alert('Despesa não encontrada.');
        return;
    }

    if (!expense.receipt) {
        alert('Recibo não encontrado.');
        return;
    }

    // Recuperar o conteúdo do recibo do localStorage
    const receiptData = localStorage.getItem(`receipt_${expenseId}`);
    if (!receiptData) {
        alert('Conteúdo do recibo não encontrado.');
        return;
    }

    // Criar modal para exibir o recibo
    const modal = document.createElement('div');
    modal.className = 'receipt-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>Recibo - ${expense.description}</h3>
            ${expense.receipt.type.startsWith('image/') 
                ? `<img src="${receiptData}" alt="Recibo" style="max-width: 100%;">`
                : `<iframe src="${receiptData}" style="width: 100%; height: 500px;"></iframe>`
            }
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar modal
    modal.querySelector('.close-modal').onclick = function() {
        modal.remove();
    };
    
    // Fechar modal ao clicar fora
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

function filterReports() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('Por favor, selecione as datas inicial e final.');
        return;
    }

    const filteredClosures = closures.filter(closure => {
        const closureDate = new Date(closure.date);
        return closureDate >= new Date(startDate) && closureDate <= new Date(endDate);
    });

    updateReportsSummary(filteredClosures);
    updateReportsTable(filteredClosures);
}

function exportToExcel() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('Por favor, selecione as datas inicial e final.');
        return;
    }

    const filteredClosures = closures.filter(closure => {
        const closureDate = new Date(closure.date);
        return closureDate >= new Date(startDate) && closureDate <= new Date(endDate);
    });

    // Criar planilha Excel
    let csvContent = "Data,ID,Usuário,Total,Numero de Despesas\n";
    filteredClosures.forEach(closure => {
        csvContent += `${formatDate(closure.date)},${closure.id},${closure.userId},${closure.total},${closure.expenses.length}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_fechamentos_${formatDate(new Date())}.csv`;
    link.click();
}

function exportToPDF() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('Por favor, selecione as datas inicial e final.');
        return;
    }

    const filteredClosures = closures.filter(closure => {
        const closureDate = new Date(closure.date);
        return closureDate >= new Date(startDate) && closureDate <= new Date(endDate);
    });

    // Aqui você pode implementar a geração do PDF usando uma biblioteca como jsPDF
    alert('Funcionalidade de exportação para PDF será implementada em breve.');
}

// Inicializar relatórios quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    loadSavedExpenses();
    loadUsers(); // Carregar usuários
    updateUI();
    initializeReports();
});

// Funções para navegação do admin
function initializeAdminNav() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remover classe active de todos os botões
            navButtons.forEach(btn => btn.classList.remove('active'));
            // Adicionar classe active ao botão clicado
            button.classList.add('active');
            
            // Esconder todas as seções
            const sections = document.querySelectorAll('.admin-section');
            sections.forEach(section => section.classList.remove('active'));
            
            // Mostrar a seção correspondente
            const sectionId = button.getAttribute('data-section') + 'Section';
            document.getElementById(sectionId).classList.add('active');
        });
    });
}

// Funções de Gerenciamento de Usuários
function showAddUserModal() {
    const modal = document.getElementById('userModal');
    modal.style.display = 'block';
    
    // Limpar formulário
    document.getElementById('userForm').reset();
    
    // Adicionar evento de fechar
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };
    
    // Fechar ao clicar fora
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

// Carregar usuários do localStorage
function loadUsers() {
    const savedUsers = localStorage.getItem('users');
    if (savedUsers) {
        mockUsers = JSON.parse(savedUsers);
    } else {
        // Se não houver usuários salvos, criar o usuário admin padrão
        mockUsers = [{
            email: 'admin@example.com',
            password: 'admin123',
            isAdmin: true,
            active: true
        }];
        saveUsers();
    }
    updateUsersTable();
}

// Salvar usuários no localStorage
function saveUsers() {
    localStorage.setItem('users', JSON.stringify(mockUsers));
}

// Atualizar tabela de usuários
function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = mockUsers.map(user => `
        <tr>
            <td>${user.email}</td>
            <td>${user.isAdmin ? 'Administrador' : 'Usuário Normal'}</td>
            <td>${user.active ? 'Ativo' : 'Inativo'}</td>
            <td class="user-actions">
                <button class="edit-user-btn" onclick="editUser('${user.email}')">
                    Editar
                </button>
                <button class="delete-user-btn" onclick="deleteUser('${user.email}')">
                    Excluir
                </button>
            </td>
        </tr>
    `).join('');
}

// Adicionar novo usuário
document.getElementById('userForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const userType = document.getElementById('userType').value;
    
    // Verificar se o email já existe
    if (mockUsers.some(user => user.email === email)) {
        alert('Este email já está cadastrado!');
        return;
    }
    
    // Criar novo usuário
    const newUser = {
        email: email,
        password: password,
        isAdmin: userType === 'admin',
        active: true
    };
    
    // Adicionar à lista de usuários
    mockUsers.push(newUser);
    saveUsers();
    updateUsersTable();
    
    // Fechar modal
    document.getElementById('userModal').style.display = 'none';
    
    alert('Usuário cadastrado com sucesso!');
});

// Editar usuário
function editUser(email) {
    const user = mockUsers.find(u => u.email === email);
    if (!user) return;
    
    const modal = document.getElementById('userModal');
    modal.style.display = 'block';
    
    // Preencher formulário com dados do usuário
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userPassword').value = user.password;
    document.getElementById('userType').value = user.isAdmin ? 'admin' : 'user';
    
    // Modificar o formulário para edição
    const form = document.getElementById('userForm');
    form.onsubmit = function(e) {
        e.preventDefault();
        
        const newEmail = document.getElementById('userEmail').value;
        const newPassword = document.getElementById('userPassword').value;
        const newUserType = document.getElementById('userType').value;
        
        // Atualizar dados do usuário
        user.email = newEmail;
        user.password = newPassword;
        user.isAdmin = newUserType === 'admin';
        
        saveUsers();
        updateUsersTable();
        
        // Fechar modal
        modal.style.display = 'none';
        
        alert('Usuário atualizado com sucesso!');
    };
}

// Excluir usuário
function deleteUser(email) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
        return;
    }
    
    const index = mockUsers.findIndex(u => u.email === email);
    if (index !== -1) {
        mockUsers.splice(index, 1);
        saveUsers();
        updateUsersTable();
        alert('Usuário excluído com sucesso!');
    }
} 