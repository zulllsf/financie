document.addEventListener('DOMContentLoaded', function() {
    const analyzeFraudButton = document.getElementById('analyze-fraud-button');
    const analysisStatus = document.getElementById('analysis-status');
    
    const totalScannedSpan = document.getElementById('total-scanned');
    const suspiciousFoundSpan = document.getElementById('suspicious-found');
    const overallRiskSpan = document.getElementById('overall-risk');
    
    const fraudReportTableBody = document.getElementById('fraud-report-table-body');
    const allTransactionsListFraudGuard = document.getElementById('all-transactions-list-fraudguard');

    // --- Function to fetch all transactions and display them with fraud info ---
    async function fetchAndDisplayAllTransactions() {
        allTransactionsListFraudGuard.innerHTML = '<li>Carregando todas as transações...</li>';
        try {
            const response = await fetch('/api/transactions'); // Assuming this fetches all transactions
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const transactions = await response.json();

            allTransactionsListFraudGuard.innerHTML = ''; // Clear existing list

            if (transactions.length === 0) {
                allTransactionsListFraudGuard.innerHTML = '<li>Nenhuma transação encontrada.</li>';
                return;
            }

            transactions.forEach(transaction => {
                const listItem = document.createElement('li');
                let fraudInfoHtml = "<em>Sem dados de análise de fraude ainda.</em>";
                if (transaction.ai_analysis_results && transaction.ai_analysis_results.fraud_guard) {
                    const fg = transaction.ai_analysis_results.fraud_guard;
                    fraudInfoHtml = `
                        <strong>Análise FraudGuard:</strong><br>
                        &nbsp;&nbsp;Suspeita: ${fg.is_suspicious ? 'Sim' : 'Não'}<br>
                        ${fg.is_suspicious ? `&nbsp;&nbsp;Razão: ${fg.reason || 'N/A'}<br>
                                              &nbsp;&nbsp;Risco: ${(fg.risk_score * 100).toFixed(0) || 'N/A'}%<br>
                                              &nbsp;&nbsp;Ação: ${fg.recommended_action || 'N/A'}<br>` : ''}
                        &nbsp;&nbsp;<small>Última Verificação: ${fg.last_scanned_at ? new Date(fg.last_scanned_at).toLocaleString() : 'N/A'}</small>
                    `;
                }
                
                listItem.innerHTML = `
                    <strong>${transaction.descricao}</strong> (${transaction.tipo}) - ${transaction.valor.toLocaleString()} AOA
                    <br>
                    Data: ${new Date(transaction.data_pagamento).toLocaleDateString()} | Status: ${transaction.status}
                    <br>
                    <small>ID: ${transaction._id}</small><br>
                    <div style="padding-left: 15px; margin-top: 5px; font-size:0.9em; color: #555;">
                       ${fraudInfoHtml}
                    </div>
                    <hr>
                `;
                allTransactionsListFraudGuard.appendChild(listItem);
            });

        } catch (error) {
            console.error('Error fetching all transactions for FraudGuard tab:', error);
            allTransactionsListFraudGuard.innerHTML = '<li>Erro ao carregar transações.</li>';
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
                    overallRiskSpan.textContent = result.summary.overall_risk_level || 'N/A';
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
                            row.insertCell().textContent = 'Ver na lista abaixo'; // Placeholder for original description
                            row.insertCell().textContent = 'Ver na lista abaixo'; // Placeholder for original amount
                            row.insertCell().textContent = 'Ver na lista abaixo'; // Placeholder for original date
                            row.insertCell().textContent = item.is_suspicious ? 'Sim' : 'Não';
                            row.insertCell().textContent = item.reason || 'N/A';
                            row.insertCell().textContent = item.risk_score !== undefined ? (item.risk_score * 100).toFixed(0) + '%' : 'N/A';
                            row.insertCell().textContent = item.recommended_action || 'N/A';
                            // Assuming the backend update_transaction added fraud_guard.last_scanned_at
                            // We'd need to re-fetch the transaction to show it, or the API could return it.
                            // For simplicity, we'll just use a generic scan ID or leave blank for now.
                            row.insertCell().textContent = `FG-${new Date().getTime()}`; // Example Scan ID
                        }
                    });
                     if (actualSuspiciousCount === 0) {
                        fraudReportTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhuma transação suspeita encontrada na análise.</td></tr>';
                    }

                } else {
                    fraudReportTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhum relatório de fraude detalhado retornado.</td></tr>';
                }
                
                // Refresh the list of all transactions to show updated fraud statuses
                fetchAndDisplayAllTransactions();

            } catch (error) {
                console.error('Error during fraud analysis:', error);
                analysisStatus.textContent = `Erro na análise: ${error.message}`;
                fraudReportTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Erro ao carregar relatório: ${error.message}</td></tr>`;
            } finally {
                analyzeFraudButton.disabled = false;
            }
        });
    }

    // Initial load of all transactions for context
    fetchAndDisplayAllTransactions();
});
