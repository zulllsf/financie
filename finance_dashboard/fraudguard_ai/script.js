document.addEventListener('DOMContentLoaded', function() {
    const analyzeFraudButton = document.getElementById('analyze-fraud-button');
    const analysisStatus = document.getElementById('analysis-status');
    
    const totalScannedSpan = document.getElementById('total-scanned');
    const suspiciousFoundSpan = document.getElementById('suspicious-found');
    const overallRiskSpan = document.getElementById('overall-risk');
    
    const fraudReportTableBody = document.getElementById('fraud-report-table-body');
    // const allTransactionsListFraudGuard = document.getElementById('all-transactions-list-fraudguard'); // Now a table body
    const allTransactionsTableBodyFraudGuard = document.getElementById('all-transactions-table-body-fraudguard');


    // --- Function to fetch all transactions and display them with fraud info ---
    async function fetchAndDisplayAllTransactions() {
        allTransactionsTableBodyFraudGuard.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando todas as transações...</td></tr>';
        try {
            const response = await fetch('/api/transactions'); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const transactions = await response.json();

            allTransactionsTableBodyFraudGuard.innerHTML = ''; // Clear existing table rows

            if (transactions.length === 0) {
                 const row = allTransactionsTableBodyFraudGuard.insertRow();
                 const cell = row.insertCell();
                 cell.colSpan = 7;
                 cell.textContent = 'Nenhuma transação encontrada.';
                 cell.style.textAlign = 'center';
                return;
            }

            transactions.forEach(transaction => {
                const row = allTransactionsTableBodyFraudGuard.insertRow();
                row.insertCell().textContent = new Date(transaction.data_pagamento).toLocaleDateString();
                row.insertCell().textContent = transaction.tipo;
                row.insertCell().textContent = transaction.descricao;
                
                const valorCell = row.insertCell();
                valorCell.textContent = transaction.valor.toLocaleString() + ' AOA';
                 // Apply valor-receita/despesa if defined in main.css (from Tab 1)
                if (transaction.tipo === 'receita') {
                    valorCell.classList.add('valor-receita'); 
                } else if (transaction.tipo === 'despesa') {
                    valorCell.classList.add('valor-despesa');
                }

                row.insertCell().textContent = transaction.status; // Original status

                const fraudStatusCell = row.insertCell();
                fraudStatusCell.classList.add('fraud-status-cell'); // For specific cell styling if needed

                if (transaction.ai_analysis_results && transaction.ai_analysis_results.fraud_guard) {
                    const fg = transaction.ai_analysis_results.fraud_guard;
                    let badgeClass = 'badge-unanalyzed'; // Default to unanalyzed or if status is unclear
                    let statusText = fg.is_suspicious ? 'Suspeita' : 'Limpa';

                    if (fg.is_suspicious === true) {
                        badgeClass = 'badge-suspicious';
                    } else if (fg.is_suspicious === false) {
                        badgeClass = 'badge-clear';
                    }
                    // Could add more conditions for error states if backend provides them
                    
                    fraudStatusCell.innerHTML = `<span class="badge ${badgeClass}">${statusText}</span>`;
                    // Tooltip for more details
                    let tooltipText = `Razão: ${fg.reason || 'N/A'}\nRisco: ${fg.risk_score !== undefined ? (fg.risk_score * 100).toFixed(0) + '%' : 'N/A'}\nAção: ${fg.recommended_action || 'N/A'}\nScan: ${fg.last_scanned_at ? new Date(fg.last_scanned_at).toLocaleString() : 'N/A'}`;
                    fraudStatusCell.title = tooltipText;

                } else {
                    fraudStatusCell.innerHTML = `<span class="badge badge-unanalyzed">Não Analisada</span>`;
                }
                
                row.insertCell().textContent = transaction._id;
            });

        } catch (error) {
            console.error('Error fetching all transactions for FraudGuard tab:', error);
            allTransactionsTableBodyFraudGuard.innerHTML = '';
            const row = allTransactionsTableBodyFraudGuard.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.textContent = 'Erro ao carregar transações.';
            cell.style.textAlign = 'center';
            cell.style.color = 'red';
        }
    }


    // --- Handle Fraud Analysis Button Click ---
    if (analyzeFraudButton) {
        analyzeFraudButton.addEventListener('click', async function() {
            analysisStatus.textContent = 'Analisando transações... Por favor, aguarde.';
            analyzeFraudButton.disabled = true;
            fraudReportTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">A processar...</td></tr>';
            totalScannedSpan.textContent = '-';
            suspiciousFoundSpan.textContent = '-';
            overallRiskSpan.textContent = '-';

            try {
                const response = await fetch('/api/detect_fraud', { method: 'POST' });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || result.details || `HTTP error ${response.status}`);
                }

                analysisStatus.textContent = 'Análise concluída.';
                
                // Display Summary
                if (result.summary) {
                    totalScannedSpan.textContent = result.summary.total_transactions_scanned !== undefined ? result.summary.total_transactions_scanned : 'N/A';
                    suspiciousFoundSpan.textContent = result.summary.suspicious_transactions_found !== undefined ? result.summary.suspicious_transactions_found : 'N/A';
                    
                    const riskLevel = (result.summary.overall_risk_level || "N/A").toLowerCase();
                    overallRiskSpan.textContent = result.summary.overall_risk_level || 'N/A';
                    overallRiskSpan.className = ''; // Reset classes
                    if (riskLevel.includes('low') || riskLevel.includes('baixo')) overallRiskSpan.classList.add('risk-low');
                    else if (riskLevel.includes('medium') || riskLevel.includes('médio')) overallRiskSpan.classList.add('risk-medium');
                    else if (riskLevel.includes('high') || riskLevel.includes('alto')) overallRiskSpan.classList.add('risk-high');
                    else if (riskLevel.includes('error')) overallRiskSpan.classList.add('risk-error');

                }

                // Display Fraud Report Table
                fraudReportTableBody.innerHTML = ''; // Clear loading/previous
                if (result.fraud_report && result.fraud_report.length > 0) {
                    let actualSuspiciousCount = 0;
                    result.fraud_report.forEach(item => {
                        // Fetch original transaction details to display alongside fraud report
                        // This is a bit inefficient here (N+1 problem if fetching one by one)
                        // Ideally, the backend would provide all necessary details or transactions are pre-fetched.
                        // For now, we'll just display what the fraud report gives.
                        // A better approach might be to fetch all transactions once and then match by ID.
                        
                        if (item.is_suspicious) {
                             actualSuspiciousCount++;
                            const row = fraudReportTableBody.insertRow();
                            row.insertCell().textContent = item.transaction_id || 'N/A';
                            row.insertCell().textContent = item.transaction_id || 'N/A'; // Keep this as is.
                            
                            // For linking to full transaction details, this would require either:
                            // 1. The backend API /api/detect_fraud to return full original transaction details
                            //    for suspicious items. This is the most robust solution.
                            // 2. Fetching all transactions first, storing them in a JS variable, then matching.
                            // For now, we'll keep it simple and not display original desc/amount/date here
                            // as the 'all transactions' table below will have them.
                            row.insertCell().textContent = "Ref. Tabela Abaixo"; 
                            row.insertCell().textContent = "Ref. Tabela Abaixo"; 
                            row.insertCell().textContent = "Ref. Tabela Abaixo"; 

                            row.insertCell().innerHTML = `<span class="badge ${item.is_suspicious ? 'badge-suspicious' : 'badge-clear'}">${item.is_suspicious ? 'Sim' : 'Não'}</span>`;
                            row.insertCell().textContent = item.reason || 'N/A';
                            row.insertCell().textContent = item.risk_score !== undefined ? (item.risk_score * 100).toFixed(0) + '%' : 'N/A';
                            row.insertCell().textContent = item.recommended_action || 'N/A';
                            // Assuming the backend update_transaction added fraud_guard.last_scanned_at
                            // We'd need to re-fetch the transaction to show it, or the API could return it.
                            // Assuming the backend update_transaction added fraud_guard.last_scanned_at
                            // This would be available if we re-fetch or if the API returns it.
                            // For now, use the scan ID from the FraudGuard report if available, or a placeholder.
                            row.insertCell().textContent = item.scan_id || `FG-${item.transaction_id.slice(-4)}`; 
                        }
                    });
                     if (actualSuspiciousCount === 0) {
                        fraudReportTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhuma transação suspeita encontrada na análise.</td></tr>';
                    }

                } else {
                    fraudReportTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhum relatório de fraude detalhado retornado.</td></tr>';
                }
                
                // Refresh the list of all transactions to show updated fraud statuses
                fetchAndDisplayAllTransactions(); // This will now update the new table

            } catch (error) {
                console.error('Error during fraud analysis:', error);
                analysisStatus.textContent = `Erro na análise: ${error.message}`;
                overallRiskSpan.className = 'risk-error'; // Style overall risk on error
                overallRiskSpan.textContent = "Erro";
                fraudReportTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Erro ao carregar relatório: ${error.message}</td></tr>`;
            } finally {
                analyzeFraudButton.disabled = false;
            }
        });
    }

    // Initial load of all transactions for context
    fetchAndDisplayAllTransactions(); // This will now render into the table

    // Active Nav Link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.main-nav ul li a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});
