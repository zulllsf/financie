document.addEventListener('DOMContentLoaded', function() {
    const analyzeRisksButton = document.getElementById('analyze-risks-button');
    const riskAnalysisStatus = document.getElementById('risk-analysis-status');
    
    const reportGenerationStatusSpan = document.getElementById('report-generation-status');
    // const overallRiskAssessmentText = document.getElementById('overall-risk-assessment-text'); // Replaced by new structure
    const overallRiskAssessmentArea = document.getElementById('overall-risk-assessment-area');
    const overallRiskAssessmentValue = document.getElementById('overall-risk-assessment-value');
    
    const kriSummaryArea = document.getElementById('kri-summary-area'); // New KRI container

    // const identifiedRisksContainer = document.getElementById('identified-risks-container'); // Renamed
    const riskCardsContainer = document.getElementById('risk-cards-container'); 
    const reportTimestampSpan = document.getElementById('report-timestamp');

    const loadPreviousRiskReportButton = document.getElementById('load-previous-risk-report-button');
    const previousRiskReportDisplayArea = document.getElementById('previous-risk-report-display-area');

    function displayRiskReport(data) {
        if (!data || !data.risk_analysis_report) {
            reportGenerationStatusSpan.textContent = "Falha ao carregar dados do relatório.";
            overallRiskAssessmentValue.textContent = "-";
            overallRiskAssessmentArea.className = ''; // Clear classes
            riskCardsContainer.innerHTML = "<p>Dados do relatório de risco indisponíveis.</p>";
            kriSummaryArea.innerHTML = "<p>Dados KRI indisponíveis.</p>";
            reportTimestampSpan.textContent = new Date().toLocaleString();
            return;
        }

        const report = data.risk_analysis_report;
        reportGenerationStatusSpan.textContent = "Relatório Carregado";
        
        // Overall Risk Assessment
        const assessmentText = report.overall_risk_assessment || "N/A";
        overallRiskAssessmentValue.textContent = assessmentText;
        overallRiskAssessmentArea.className = ''; // Reset classes
        if (assessmentText && assessmentText !== "N/A") {
            const assessmentClass = `assessment-${assessmentText.toLowerCase().replace(' ', '-')}`;
            overallRiskAssessmentArea.classList.add(assessmentClass);
        }
        
        // Display KRIs
        kriSummaryArea.innerHTML = ''; // Clear previous
        if (report.key_risk_indicators_summary) {
            const kris = report.key_risk_indicators_summary;
            const kriMap = {
                "Volatilidade do Fluxo de Caixa (Desvio Padrão AOA, últimos 3m)": kris.cash_flow_volatility_last_3m_std_dev_AOA,
                "Despesas Mensais Médias (AOA)": kris.average_monthly_expenses_AOA,
                "Dias de Caixa Disponível (Estimativa)": kris.days_of_cash_on_hand,
                "Concentração de Fontes de Renda (%)": kris.income_source_concentration_percentage,
                "Descrição Concentração de Renda": kris.income_source_concentration_description,
                "Grandes Pagamentos Próximos (AOA, próximos 30 dias)": kris.upcoming_large_payments_next_30d_AOA,
                "Saldo de Caixa Estimado Atual (AOA)": kris.estimated_current_cash_balance_AOA
            };

            for (const [key, value] of Object.entries(kriMap)) {
                if (value === undefined && key === "Descrição Concentração de Renda" && kriMap["Concentração de Fontes de Renda (%)"] === 0) continue; // Skip desc if perc is 0
                if (value === undefined) continue; // Skip if KRI data point is missing

                const kriItemDiv = document.createElement('div');
                kriItemDiv.className = 'kri-item';
                
                const kriNameH5 = document.createElement('h5');
                kriNameH5.textContent = key;
                
                const kriValueP = document.createElement('p');
                kriValueP.textContent = (typeof value === 'number' && key.includes("AOA") ) ? value.toLocaleString() + ' AOA' : (typeof value === 'number' && key.includes("(%)")) ? value + '%' : value;
                if (key === "Descrição Concentração de Renda") { // Special handling for description only
                    kriValueP.style.fontSize = "0.9em";
                    kriValueP.style.fontWeight = "normal";
                    kriValueP.style.color = "#555";
                }


                kriItemDiv.appendChild(kriNameH5);
                kriItemDiv.appendChild(kriValueP);
                kriSummaryArea.appendChild(kriItemDiv);
            }
             if (kriSummaryArea.children.length === 0) {
                kriSummaryArea.innerHTML = "<p>Dados KRI não detalhados no relatório.</p>";
            }
        } else {
            kriSummaryArea.innerHTML = "<p>Sumário KRI não disponível.</p>";
        }

        // Display Identified Risks
        riskCardsContainer.innerHTML = ""; // Clear previous
        if (report.identified_risks && report.identified_risks.length > 0) {
            report.identified_risks.forEach(risk => {
                const riskCard = document.createElement('div');
                riskCard.className = 'risk-card';

                const riskNameH5 = document.createElement('h5');
                riskNameH5.textContent = risk.risk_name || "Risco Não Especificado";
                riskCard.appendChild(riskNameH5);

                const descriptionP = document.createElement('p');
                descriptionP.innerHTML = `<strong>Descrição:</strong> ${risk.description || "N/A"}`;
                riskCard.appendChild(descriptionP);

                const impactP = document.createElement('p');
                const impactVal = risk.potential_impact || "N/A";
                impactP.innerHTML = `<strong>Impacto Potencial:</strong> <span class="impact-${impactVal.toLowerCase()}">${impactVal}</span>`;
                riskCard.appendChild(impactP);
                
                const likelihoodP = document.createElement('p');
                const likelihoodVal = risk.likelihood || "N/A";
                likelihoodP.innerHTML = `<strong>Probabilidade:</strong> <span class="likelihood-${likelihoodVal.toLowerCase()}">${likelihoodVal}</span>`;
                riskCard.appendChild(likelihoodP);

                const mitigationDiv = document.createElement('div');
                mitigationDiv.className = 'mitigation-strategy';
                mitigationDiv.innerHTML = `<strong>Mitigação Sugerida:</strong> ${risk.suggested_mitigation || "N/A"}`;
                riskCard.appendChild(mitigationDiv);
                
                riskCardsContainer.appendChild(riskCard);
            });
        } else {
            riskCardsContainer.innerHTML = "<p>Nenhum risco específico foi identificado nesta análise.</p>";
        }
        
        reportTimestampSpan.textContent = data.analysis_timestamp ? new Date(data.analysis_timestamp).toLocaleString() : (report.analysis_timestamp ? new Date(report.analysis_timestamp).toLocaleString() : (report.created_at ? new Date(report.created_at).toLocaleString() : new Date().toLocaleString()));
    }
    
    // Removed clearKriSpans as kriSummaryArea is now cleared and repopulated directly


    if (analyzeRisksButton) {
        analyzeRisksButton.addEventListener('click', async function() {
            riskAnalysisStatus.textContent = 'Analisando riscos... Por favor, aguarde.';
            analyzeRisksButton.disabled = true;
            reportGenerationStatusSpan.textContent = "Processando...";
            riskCardsContainer.innerHTML = "<p>Aguarde enquanto os riscos são analisados...</p>";
            kriSummaryArea.innerHTML = "<p>A processar KRIs...</p>"; // Clear and set loading for KRIs
            overallRiskAssessmentArea.className = ''; // Clear assessment style
            overallRiskAssessmentValue.textContent = "A processar...";


            try {
                const response = await fetch('/api/analyze_risk', { method: 'POST' });
                const result = await response.json(); 

                if (!response.ok) {
                    const errorMsg = result.error || result.details || (result.sample_data && result.sample_data.risk_analysis_report ? result.sample_data.risk_analysis_report.identified_risks[0].description : `HTTP error ${response.status}`);
                    displayRiskReport(result.sample_data || { risk_analysis_report: { overall_risk_assessment: "Error", identified_risks: [], key_risk_indicators_summary: {} }, analysis_timestamp: new Date().toISOString() }); // Display sample on error
                    throw new Error(errorMsg);
                }
                
                riskAnalysisStatus.textContent = 'Análise de riscos concluída com sucesso.';
                displayRiskReport(result); 

            } catch (error) {
                console.error('Error during risk analysis:', error);
                riskAnalysisStatus.textContent = `Erro na análise de riscos: ${error.message}`;
                reportGenerationStatusSpan.textContent = "Erro";
                // overallRiskAssessmentValue.textContent = "Falha na análise"; // Already handled by displayRiskReport on error
                // riskCardsContainer.innerHTML = `<p>Ocorreu um erro: ${error.message}</p>`;
                 if (!document.querySelector('#overall-risk-assessment-area').className.includes('assessment-')) {
                    overallRiskAssessmentArea.className = ''; // Clear if no specific error style applied by displayRiskReport
                    overallRiskAssessmentArea.classList.add('assessment-elevated'); // Default error visual
                    overallRiskAssessmentValue.textContent = "Erro na Análise";
                }
                if (riskCardsContainer.innerHTML.includes("Aguarde")) { // If not already populated by displayRiskReport's error handling
                    riskCardsContainer.innerHTML = `<p>Ocorreu um erro ao carregar os detalhes dos riscos: ${error.message}</p>`;
                }
                 if (kriSummaryArea.innerHTML.includes("A processar KRIs...")) {
                    kriSummaryArea.innerHTML = `<p>Ocorreu um erro ao carregar KRIs: ${error.message}</p>`;
                }


            } finally {
                analyzeRisksButton.disabled = false;
            }
        });
    }

    if (loadPreviousRiskReportButton) {
        loadPreviousRiskReportButton.addEventListener('click', async function() {
            previousRiskReportDisplayArea.textContent = "A carregar relatório de risco anterior...";
            loadPreviousRiskReportButton.disabled = true;

            try {
                 previousRiskReportDisplayArea.innerHTML = `
                    <p><strong>Funcionalidade Pendente:</strong></p>
                    <p>Para carregar o relatório anterior, um novo endpoint GET <code>/api/latest_risk_report</code>
                    precisa ser implementado no backend (<code>app.py</code>). Esse endpoint chamaria a função 
                    <code>get_latest_risk_report()</code> de <code>database.py</code> e retornaria o resultado.</p>
                    <p>O JavaScript seria então atualizado para fazer a chamada e formatar os dados para a função <code>displayRiskReport</code>.</p>
                `;

            } catch (error) {
                console.error("Error loading previous risk report:", error);
                previousRiskReportDisplayArea.textContent = `Erro ao carregar relatório: ${error.message}`;
            } finally {
                loadPreviousRiskReportButton.disabled = false;
            }
        });
    }

    // Initial state message
    reportGenerationStatusSpan.textContent = "Aguardando início da análise.";
    kriSummaryArea.innerHTML = "<p>Clique no botão acima para iniciar a análise de riscos e carregar os KRIs.</p>";
    overallRiskAssessmentValue.textContent = "-";

    // Active Nav Link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.main-nav ul li a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});
