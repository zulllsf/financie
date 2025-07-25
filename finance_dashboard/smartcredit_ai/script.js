document.addEventListener('DOMContentLoaded', function() {
    const analyzeCreditButton = document.getElementById('analyze-credit-button');
    const creditAnalysisStatus = document.getElementById('credit-analysis-status');
    
    const reportStatusSpan = document.getElementById('report-status');
    const assessmentSummaryText = document.getElementById('assessment-summary-text');
    const creditScoreDisplay = document.getElementById('credit-score-display'); // ID updated
    const creditLimitDisplay = document.getElementById('credit-limit-display'); // ID updated
    const confidenceLevelDisplay = document.getElementById('confidence-level-display'); // ID updated
    const positiveFactorsList = document.getElementById('positive-factors-list');
    const negativeFactorsList = document.getElementById('negative-factors-list');
    const reportTimestampSpan = document.getElementById('report-timestamp');

    const loadPreviousReportButton = document.getElementById('load-previous-report-button');
    const previousReportDisplayArea = document.getElementById('previous-report-display-area');

    function displayCreditReport(reportData) {
        if (!reportData || !reportData.credit_analysis_report) {
            reportStatusSpan.textContent = "Falha ao carregar dados do relatório.";
            assessmentSummaryText.textContent = "-";
            creditScoreDisplay.textContent = "-"; // Updated ID
            creditLimitDisplay.textContent = "-"; // Updated ID
            confidenceLevelDisplay.textContent = "-"; // Updated ID
            confidenceLevelDisplay.className = ''; // Clear previous classes
            positiveFactorsList.innerHTML = "<li>-</li>";
            negativeFactorsList.innerHTML = "<li>-</li>";
            reportTimestampSpan.textContent = new Date().toLocaleString();
            return;
        }

        const report = reportData.credit_analysis_report;
        reportStatusSpan.textContent = "Relatório Carregado";
        assessmentSummaryText.textContent = report.assessment_summary || "N/A";
        creditScoreDisplay.textContent = report.credit_score || "N/A"; // Updated ID
        creditLimitDisplay.textContent = report.recommended_credit_limit_AOA !== undefined ? report.recommended_credit_limit_AOA.toLocaleString() + " AOA" : "N/A"; // Updated ID
        
        confidenceLevelDisplay.textContent = report.confidence_level || "N/A"; // Updated ID
        confidenceLevelDisplay.className = ''; // Reset classes before applying new one
        if (report.confidence_level) {
            const levelClass = `confidence-${report.confidence_level.toLowerCase()}`;
            confidenceLevelDisplay.classList.add(levelClass);
        }

        positiveFactorsList.innerHTML = "";
        if (report.key_positive_factors && report.key_positive_factors.length > 0) {
            report.key_positive_factors.forEach(factor => {
                const li = document.createElement('li');
                li.textContent = factor;
                positiveFactorsList.appendChild(li);
            });
        } else {
            positiveFactorsList.innerHTML = "<li>Nenhum fator positivo específico listado.</li>";
        }

        negativeFactorsList.innerHTML = "";
        if (report.key_negative_factors && report.key_negative_factors.length > 0) {
            report.key_negative_factors.forEach(factor => {
                const li = document.createElement('li');
                li.textContent = factor;
                negativeFactorsList.appendChild(li);
            });
        } else {
            negativeFactorsList.innerHTML = "<li>Nenhum fator negativo específico listado.</li>";
        }
        
        // Use timestamp from the report if available (either 'created_at' from DB or 'analysis_timestamp' from Gemini)
        const timestamp = report.created_at || report.analysis_timestamp || (reportData.analysis_timestamp); // Check top level if not in sub-report
        reportTimestampSpan.textContent = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();
    }

    if (analyzeCreditButton) {
        analyzeCreditButton.addEventListener('click', async function() {
            creditAnalysisStatus.textContent = 'Realizando análise de crédito... Por favor, aguarde.';
            analyzeCreditButton.disabled = true;
            reportStatusSpan.textContent = "Processando...";

            try {
                const response = await fetch('/api/analyze_credit', { method: 'POST' });
                const result = await response.json();

                if (!response.ok) {
                    const errorMsg = result.error || result.details || `HTTP error ${response.status}`;
                    throw new Error(errorMsg);
                }
                
                creditAnalysisStatus.textContent = 'Análise de crédito concluída com sucesso.';
                displayCreditReport(result); // The API returns the full structure including "credit_analysis_report"

            } catch (error) {
                console.error('Error during credit analysis:', error);
                creditAnalysisStatus.textContent = `Erro na análise de crédito: ${error.message}`;
                reportStatusSpan.textContent = "Erro";
                assessmentSummaryText.textContent = error.message;
            } finally {
                analyzeCreditButton.disabled = false;
            }
        });
    }

    if (loadPreviousReportButton) {
        loadPreviousReportButton.addEventListener('click', async function() {
            // This part is a bit tricky as the current backend doesn't have a direct endpoint
            // to GET the latest report for the frontend. The `get_latest_credit_report` is in database.py.
            // For now, I'll simulate by just displaying a message, or we can add an endpoint.
            // Let's assume we add a GET /api/latest_credit_report endpoint.
            
            previousReportDisplayArea.textContent = "A carregar relatório anterior...";
            loadPreviousReportButton.disabled = true;

            // Placeholder: Add a new endpoint GET /api/latest_credit_report in app.py
            // that calls get_latest_credit_report() from database.py
            try {
                // const response = await fetch('/api/latest_credit_report'); // Assumed new endpoint
                // if (!response.ok) {
                //     const errorData = await response.json();
                //     throw new Error(errorData.error || `HTTP Error: ${response.status}`);
                // }
                // const report = await response.json();
                // if (report && Object.keys(report).length > 0) {
                //     // We need to ensure the structure matches what displayCreditReport expects
                //     // The get_latest_credit_report() returns just the report part.
                //     displayCreditReport({ credit_analysis_report: report });
                //     previousReportDisplayArea.textContent = "Relatório anterior carregado na secção principal.";
                // } else {
                //     previousReportDisplayArea.textContent = "Nenhum relatório anterior encontrado.";
                // }
                previousReportDisplayArea.innerHTML = `
                    <p><strong>Funcionalidade Pendente:</strong></p>
                    <p>Para carregar o relatório anterior, um novo endpoint GET <code>/api/latest_credit_report</code>
                    precisa ser implementado no backend (<code>app.py</code>). Esse endpoint chamaria a função 
                    <code>get_latest_credit_report()</code> de <code>database.py</code> e retornaria o resultado.</p>
                    <p>Após a implementação do endpoint, o JavaScript seria atualizado para fazer a chamada e exibir os dados.</p>
                `;

            } catch (error) {
                console.error("Error loading previous report:", error);
                previousReportDisplayArea.textContent = `Erro ao carregar relatório anterior: ${error.message}`;
            } finally {
                loadPreviousReportButton.disabled = false;
            }
        });
    }

    // Initial state message
    reportStatusSpan.textContent = "Aguardando início da análise.";

    // Active Nav Link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.main-nav ul li a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});
