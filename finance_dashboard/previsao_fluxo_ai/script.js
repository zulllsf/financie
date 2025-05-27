document.addEventListener('DOMContentLoaded', function() {
    const transactionForm = document.getElementById('transaction-form');
    const transactionsList = document.getElementById('transactions-list');
    const formMessage = document.getElementById('form-message');
    const formError = document.getElementById('form-error');
    
    const analyzeAiButton = document.getElementById('analyze-ai-button');
    const aiPredictionText = document.getElementById('ai-prediction-text');
    const aiTipsList = document.getElementById('ai-tips-list');
    const aiEvaluationDetails = document.getElementById('ai-evaluation-details');
    const cashflowChartCanvas = document.getElementById('cashflow-chart');
    let cashFlowChartInstance = null;

    // File Upload Elements
    const uploadForm = document.getElementById('upload-form');
    const transactionFileInput = document.getElementById('transaction-file-input');
    const uploadMessage = document.getElementById('upload-message');
    const uploadError = document.getElementById('upload-error');
    const uploadFileButton = document.getElementById('upload-file-button');


    // --- Display AI Analysis Results ---
    function displayAiAnalysis(analysisData) {
        if (!analysisData) {
            aiPredictionText.textContent = "Nenhuma análise disponível.";
            aiTipsList.innerHTML = '<li>-</li>';
            aiEvaluationDetails.innerHTML = '-';
            return;
        }

        if (aiPredictionText && analysisData.cash_flow_forecast) {
            const forecast = analysisData.cash_flow_forecast;
            aiPredictionText.textContent = `Tendência: ${forecast.trend_description || 'N/A'}, 
                Previsão Próximo Mês: ${(forecast.next_month_prediction_AOA || 0).toLocaleString()} AOA,
                Total Três Meses: ${(forecast.three_month_total_AOA || 0).toLocaleString()} AOA
                (Confiança: ${forecast.confidence_score !== undefined ? (forecast.confidence_score * 100).toFixed(0) + '%' : 'N/A'})`;
        } else if (aiPredictionText) {
            aiPredictionText.textContent = "Previsão de fluxo de caixa não disponível.";
        }

        if (aiTipsList && analysisData.improvement_tips && analysisData.improvement_tips.length > 0) {
            aiTipsList.innerHTML = ''; 
            analysisData.improvement_tips.forEach(tip => {
                const listItem = document.createElement('li');
                listItem.textContent = tip;
                aiTipsList.appendChild(listItem);
            });
        } else if (aiTipsList) {
            aiTipsList.innerHTML = '<li>Nenhuma dica de melhoria disponível.</li>';
        }

        if (aiEvaluationDetails && analysisData.evaluation_percentages) {
            const evalData = analysisData.evaluation_percentages;
            let detailsHtml = `
                Rácio Receitas/Despesas: ${evalData.income_vs_expense_ratio || 'N/A'}<br>
                Taxa de Poupança Prevista: ${evalData.savings_rate_forecast || 'N/A'}<br>
            `;
            if (evalData.key_expense_categories) {
                detailsHtml += "Categorias Chave de Despesa:<br>";
                for (const [key, value] of Object.entries(evalData.key_expense_categories)) {
                    detailsHtml += `&nbsp;&nbsp;- ${key}: ${value}<br>`;
                }
            }
            aiEvaluationDetails.innerHTML = detailsHtml;
        } else if (aiEvaluationDetails) {
            aiEvaluationDetails.innerHTML = "Detalhes da avaliação não disponíveis.";
        }
    }

    // --- Implement Charting ---
    function renderCashFlowChart(chartData) {
        if (cashFlowChartInstance) {
            cashFlowChartInstance.destroy(); 
        }
        if (cashflowChartCanvas && chartData && chartData.labels && chartData.datasets) {
            const ctx = cashflowChartCanvas.getContext('2d');
            cashFlowChartInstance = new Chart(ctx, {
                type: 'bar', 
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString() + ' AOA';
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toLocaleString() + ' AOA';
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        } else if (cashflowChartCanvas) { 
            const ctx = cashflowChartCanvas.getContext('2d');
            ctx.clearRect(0, 0, cashflowChartCanvas.width, cashflowChartCanvas.height);
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Dados do gráfico não disponíveis.", cashflowChartCanvas.width / 2, cashflowChartCanvas.height / 2);
        }
    }

    // --- Fetch and Display Transactions ---
    async function fetchTransactions() {
        try {
            const response = await fetch('/api/transactions');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const transactions = await response.json();
            transactionsList.innerHTML = ''; 

            if (transactions.length === 0) {
                transactionsList.innerHTML = '<li>Nenhuma transação encontrada.</li>';
                return;
            }

            transactions.forEach(transaction => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>${transaction.descricao}</strong> (${transaction.tipo}) - ${transaction.valor.toLocaleString()} AOA
                    <br>
                    Data: ${new Date(transaction.data_pagamento).toLocaleDateString()} | Status: ${transaction.status}
                    <br>
                    <small>ID: ${transaction._id} | Criado em: ${new Date(transaction.created_at).toLocaleString()}</small>
                `;
                transactionsList.appendChild(listItem);
            });

        } catch (error) {
            console.error('Error fetching transactions:', error);
            transactionsList.innerHTML = '<li>Erro ao carregar transações.</li>';
        }
    }

    // --- Handle Manual Form Submission ---
    if (transactionForm) {
        transactionForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            formMessage.textContent = '';
            formError.textContent = '';

            const formData = new FormData(transactionForm);
            const data = {
                tipo: formData.get('tipo'),
                descricao: formData.get('descricao'),
                valor: formData.get('valor'),
                data_pagamento: formData.get('data_pagamento'),
                status: formData.get('status')
            };

            try {
                const response = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    formMessage.textContent = result.message || 'Transação adicionada com sucesso!';
                    transactionForm.reset();
                    fetchTransactions(); 
                } else {
                    formError.textContent = result.error || `Erro: ${response.statusText}`;
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                formError.textContent = 'Erro ao submeter o formulário. Verifique a consola.';
            }
        });
    }

    // --- Handle File Upload Form Submission ---
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            uploadMessage.textContent = '';
            uploadError.textContent = '';

            if (!transactionFileInput.files || transactionFileInput.files.length === 0) {
                uploadError.textContent = 'Por favor, selecione um arquivo para carregar.';
                return;
            }

            const file = transactionFileInput.files[0];
            const formData = new FormData();
            formData.append('transaction_file', file);

            uploadFileButton.disabled = true;
            uploadFileButton.textContent = 'Carregando...';

            try {
                const response = await fetch('/api/upload_transactions', {
                    method: 'POST',
                    body: formData // No 'Content-Type' header needed, browser sets it for FormData
                });

                const result = await response.json();

                if (response.ok || response.status === 207) { // 207 Multi-Status for partial success
                    uploadMessage.textContent = result.message || 'Arquivo processado.';
                    if (result.errors && result.errors.length > 0) {
                        uploadError.innerHTML = "Algumas linhas tiveram erros:<br>" + result.errors.join("<br>");
                    }
                    fetchTransactions(); // Refresh the list
                } else {
                    uploadError.textContent = result.error || `Erro no upload: ${response.statusText}`;
                    if (result.errors && result.errors.length > 0) {
                         uploadError.innerHTML += "<br>Detalhes:<br>" + result.errors.join("<br>");
                    }
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                uploadError.textContent = 'Erro ao carregar o arquivo. Verifique a consola.';
            } finally {
                uploadFileButton.disabled = false;
                uploadFileButton.textContent = 'Carregar Arquivo';
                uploadForm.reset(); // Clear the file input
            }
        });
    }

    // --- Event Listener for AI Analysis Button ---
    if (analyzeAiButton) {
        analyzeAiButton.addEventListener('click', async function() {
            analyzeAiButton.disabled = true;
            analyzeAiButton.textContent = "Analisando...";
            aiPredictionText.textContent = "A processar pedido de análise...";
            aiTipsList.innerHTML = '<li>Aguarde...</li>';
            aiEvaluationDetails.innerHTML = "Aguarde...";
            if (cashFlowChartInstance) cashFlowChartInstance.destroy();

            try {
                const response = await fetch('/api/analyze_cashflow', { method: 'POST' });
                const analysisResult = await response.json();

                if (!response.ok) {
                    throw new Error(analysisResult.error || `HTTP error ${response.status}`);
                }
                
                displayAiAnalysis(analysisResult);
                if (analysisResult.chart_data) {
                    renderCashFlowChart(analysisResult.chart_data);
                } else {
                    renderCashFlowChart({ labels: [], datasets: [] });
                }
                // alert("Análise com IA concluída!"); // Can be removed or made less intrusive

            } catch (error) {
                console.error('Error fetching AI analysis:', error);
                aiPredictionText.textContent = "Erro ao obter análise da IA.";
                aiTipsList.innerHTML = '<li>Verifique a consola para detalhes do erro.</li>';
                aiEvaluationDetails.innerHTML = `Detalhes do erro: ${error.message}`;
                renderCashFlowChart({ labels: [], datasets: [] }); 
                // alert("Erro ao realizar análise com IA."); // Can be removed
            } finally {
                analyzeAiButton.disabled = false;
                analyzeAiButton.textContent = "Analisar com IA";
            }
        });
    }

    // Initial load
    fetchTransactions();
    renderCashFlowChart(null); 
});
