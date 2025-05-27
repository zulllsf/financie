document.addEventListener('DOMContentLoaded', function() {
    const analyzeRisksButton = document.getElementById('analyze-risks-button');
    const riskAnalysisStatus = document.getElementById('risk-analysis-status');
    
    const reportGenerationStatusSpan = document.getElementById('report-generation-status');
    const overallRiskAssessmentText = document.getElementById('overall-risk-assessment-text');
    
    // KRI Spans
    const kriVolatilitySpan = document.getElementById('kri-volatility');
    const kriAvgExpensesSpan = document.getElementById('kri-avg-expenses');
    const kriCashDaysSpan = document.getElementById('kri-cash-days');
    const kriIncomeConcentrationPercSpan = document.getElementById('kri-income-concentration-perc');
    const kriIncomeConcentrationDescSpan = document.getElementById('kri-income-concentration-desc');
    const kriUpcomingPaymentsSpan = document.getElementById('kri-upcoming-payments');
    const kriCurrentBalanceSpan = document.getElementById('kri-current-balance');

    const identifiedRisksContainer = document.getElementById('identified-risks-container');
    const reportTimestampSpan = document.getElementById('report-timestamp');

    const loadPreviousRiskReportButton = document.getElementById('load-previous-risk-report-button');
    const previousRiskReportDisplayArea = document.getElementById('previous-risk-report-display-area');

    function displayRiskReport(data) {
        if (!data || !data.risk_analysis_report) {
            reportGenerationStatusSpan.textContent = "Falha ao carregar dados do relatório.";
            overallRiskAssessmentText.textContent = "-";
            identifiedRisksContainer.innerHTML = "<p>Dados do relatório de risco indisponíveis.</p>";
            clearKriSpans();
            reportTimestampSpan.textContent = new Date().toLocaleString();
            return;
        }

        const report = data.risk_analysis_report;
        reportGenerationStatusSpan.textContent = "Relatório Carregado";
        overallRiskAssessmentText.textContent = report.overall_risk_assessment || "N/A";
        
        // Display KRIs
        if (report.key_risk_indicators_summary) {
            const kris = report.key_risk_indicators_summary;
            kriVolatilitySpan.textContent = kris.cash_flow_volatility_last_3m_std_dev_AOA !== undefined ? kris.cash_flow_volatility_last_3m_std_dev_AOA.toLocaleString() : "N/A";
            kriAvgExpensesSpan.textContent = kris.average_monthly_expenses_AOA !== undefined ? kris.average_monthly_expenses_AOA.toLocaleString() : "N/A";
            kriCashDaysSpan.textContent = kris.days_of_cash_on_hand !== undefined ? kris.days_of_cash_on_hand : "N/A";
            kriIncomeConcentrationPercSpan.textContent = kris.income_source_concentration_percentage !== undefined ? kris.income_source_concentration_percentage + "%" : "N/A";
            kriIncomeConcentrationDescSpan.textContent = kris.income_source_concentration_description || "N/A";
            kriUpcomingPaymentsSpan.textContent = kris.upcoming_large_payments_next_30d_AOA !== undefined ? kris.upcoming_large_payments_next_30d_AOA.toLocaleString() : "N/A";
            kriCurrentBalanceSpan.textContent = kris.estimated_current_cash_balance_AOA !== undefined ? kris.estimated_current_cash_balance_AOA.toLocaleString() : "N/A";
        } else {
            clearKriSpans();
        }

        // Display Identified Risks
        identifiedRisksContainer.innerHTML = ""; // Clear previous
        if (report.identified_risks && report.identified_risks.length > 0) {
            report.identified_risks.forEach(risk => {
                const riskCard = document.createElement('div');
                riskCard.className = 'risk-card';
                riskCard.innerHTML = `
                    <h4>${risk.risk_name || "Risco Não Especificado"}</h4>
                    <div class="risk-details">
                        <p><strong>Descrição:</strong> ${risk.description || "N/A"}</p>
                        <p><strong>Impacto Potencial:</strong> ${risk.potential_impact || "N/A"}</p>
                        <p><strong>Probabilidade:</strong> ${risk.likelihood || "N/A"}</p>
                        <p><strong>Mitigação Sugerida:</strong> ${risk.suggested_mitigation || "N/A"}</p>
                    </div>
                `;
                identifiedRisksContainer.appendChild(riskCard);
            });
        } else {
            identifiedRisksContainer.innerHTML = "<p>Nenhum risco específico foi identificado nesta análise.</p>";
        }
        
        reportTimestampSpan.textContent = data.analysis_timestamp ? new Date(data.analysis_timestamp).toLocaleString() : (report.analysis_timestamp ? new Date(report.analysis_timestamp).toLocaleString() : (report.created_at ? new Date(report.created_at).toLocaleString() : new Date().toLocaleString()));
    }
    
    function clearKriSpans() {
        kriVolatilitySpan.textContent = "-";
        kriAvgExpensesSpan.textContent = "-";
        kriCashDaysSpan.textContent = "-";
        kriIncomeConcentrationPercSpan.textContent = "-";
        kriIncomeConcentrationDescSpan.textContent = "-";
        kriUpcomingPaymentsSpan.textContent = "-";
        kriCurrentBalanceSpan.textContent = "-";
    }


    if (analyzeRisksButton) {
        analyzeRisksButton.addEventListener('click', async function() {
            riskAnalysisStatus.textContent = 'Analisando riscos... Por favor, aguarde.';
            analyzeRisksButton.disabled = true;
            reportGenerationStatusSpan.textContent = "Processando...";
            identifiedRisksContainer.innerHTML = "<p>Aguarde enquanto os riscos são analisados...</p>";
            clearKriSpans();

            try {
                const response = await fetch('/api/analyze_risk', { method: 'POST' });
                const result = await response.json(); // This result should be the full Gemini response

                if (!response.ok) {
                    const errorMsg = result.error || result.details || (result.sample_data && result.sample_data.risk_analysis_report ? result.sample_data.risk_analysis_report.identified_risks[0].description : `HTTP error ${response.status}`);
                    throw new Error(errorMsg);
                }
                
                riskAnalysisStatus.textContent = 'Análise de riscos concluída com sucesso.';
                // The backend returns the full structure, including "risk_analysis_report" and "analysis_timestamp" at the top level
                displayRiskReport(result); 

            } catch (error) {
                console.error('Error during risk analysis:', error);
                riskAnalysisStatus.textContent = `Erro na análise de riscos: ${error.message}`;
                reportGenerationStatusSpan.textContent = "Erro";
                overallRiskAssessmentText.textContent = "Falha na análise";
                identifiedRisksContainer.innerHTML = `<p>Ocorreu um erro: ${error.message}</p>`;
            } finally {
                analyzeRisksButton.disabled = false;
            }
        });
    }

    if (loadPreviousRiskReportButton) {
        loadPreviousRiskReportButton.addEventListener('click', async function() {
            previousRiskReportDisplayArea.textContent = "A carregar relatório de risco anterior...";
            loadPreviousRiskReportButton.disabled = true;

            // Placeholder: Add a new endpoint GET /api/latest_risk_report in app.py
            // that calls get_latest_risk_report() from database.py
            try {
                // const response = await fetch('/api/latest_risk_report'); // Assumed new endpoint
                // if (!response.ok) {
                //     const errorData = await response.json();
                //     throw new Error(errorData.error || `HTTP Error: ${response.status}`);
                // }
                // const report = await response.json(); // This would be just the report part from DB
                // if (report && Object.keys(report).length > 0) {
                //     // Adjust to match the structure displayRiskReport expects (needs 'risk_analysis_report' and 'analysis_timestamp')
                //     displayRiskReport({ risk_analysis_report: report, analysis_timestamp: report.created_at || report.analysis_timestamp });
                //     previousRiskReportDisplayArea.textContent = "Relatório anterior carregado na secção principal.";
                // } else {
                //     previousRiskReportDisplayArea.textContent = "Nenhum relatório de risco anterior encontrado.";
                // }
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
    clearKriSpans();
});
