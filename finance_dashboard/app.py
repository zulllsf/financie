from flask import Flask, request, jsonify, send_from_directory
from database import (
    add_transaction,
    get_transactions,
    update_transaction, # Import if you need to update individual transactions
    get_transaction_by_id, # Import if you need to fetch a specific transaction
    add_ai_forecast,
    get_latest_ai_forecast
)
from datetime import datetime
import os
import json # For parsing Gemini's potential string response
import google.generativeai as genai
from dotenv import load_dotenv
import pandas as pd
import numpy as np # For numerical operations like standard deviation
from datetime import timedelta # Already used, ensure it's available

load_dotenv() # Load environment variables from .env

app = Flask(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- API Endpoints ---

@app.route('/api/transactions', methods=['POST'])
def api_add_transaction():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        required_fields = ['tipo', 'descricao', 'valor', 'data_pagamento', 'status']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        try:
            data['valor'] = float(data['valor'])
        except ValueError:
            return jsonify({"error": "Invalid 'valor', must be a number"}), 400

        try:
            data['data_pagamento'] = datetime.fromisoformat(data['data_pagamento'].split('T')[0])
        except ValueError:
            return jsonify({"error": "Invalid 'data_pagamento' format, expected YYYY-MM-DD"}), 400

        transaction_id = add_transaction(data)
        if transaction_id:
            new_transaction = get_transaction_by_id(str(transaction_id)) # Fetch to get all fields including defaults
            if new_transaction.get("data_pagamento") and isinstance(new_transaction["data_pagamento"], datetime):
                 new_transaction["data_pagamento"] = new_transaction["data_pagamento"].isoformat()
            if new_transaction.get("created_at") and isinstance(new_transaction["created_at"], datetime):
                 new_transaction["created_at"] = new_transaction["created_at"].isoformat()
            if "_id" in new_transaction:
                new_transaction["_id"] = str(new_transaction["_id"])
            return jsonify({"message": "Transaction added successfully", "transaction": new_transaction}), 201
        else:
            return jsonify({"error": "Failed to add transaction"}), 500

    except Exception as e:
        app.logger.error(f"Error adding transaction: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/transactions', methods=['GET'])
def api_get_transactions():
    try:
        filters = request.args.to_dict()
        transactions = get_transactions(filters)
        for transaction in transactions:
            if "_id" in transaction:
                transaction["_id"] = str(transaction["_id"])
            if "data_pagamento" in transaction and isinstance(transaction["data_pagamento"], datetime):
                transaction["data_pagamento"] = transaction["data_pagamento"].isoformat()
            if "created_at" in transaction and isinstance(transaction["created_at"], datetime):
                transaction["created_at"] = transaction["created_at"].isoformat()
        return jsonify(transactions), 200
    except Exception as e:
        app.logger.error(f"Error fetching transactions: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/api/analyze_cashflow', methods=['POST'])
def analyze_cashflow():
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        app.logger.warn("Gemini API key not configured. Returning sample analysis.")
        # Simulate Gemini response structure
        sample_gemini_response = {
            "cash_flow_forecast": {
                "next_month_prediction_AOA": 1200000.75,
                "three_month_total_AOA": 3500000.00,
                "trend_description": "Slightly positive cash flow trend expected if current income and expense patterns continue.",
                "confidence_score": 0.70
            },
            "improvement_tips": [
                "Consider reducing discretionary spending on entertainment by 15%.",
                "Look for opportunities to increase freelance income by seeking 1-2 new small projects.",
                "Review monthly subscriptions and cancel any that are unused."
            ],
            "evaluation_percentages": {
                "income_vs_expense_ratio": "120%", # Income is 120% of expenses
                "savings_rate_forecast": "15%", # Projecting a 15% savings rate
                "key_expense_categories": {
                    "Aluguel": "40%",
                    "Alimentação": "25%",
                    "Transporte": "15%"
                }
            },
            "currency": "AOA",
            # Adding a sample structure for the chart, as Gemini might not provide it directly in this format
            "chart_data": {
                 "labels": ["Mês Anterior", "Mês Atual", "Próximo Mês (Previsto)"],
                 "datasets": [
                    {
                        "label": "Receitas (AOA)",
                        "data": [1000000, 1100000, 1200000.75], # Sample data
                        "borderColor": 'rgba(75, 192, 192, 1)',
                        "backgroundColor": 'rgba(75, 192, 192, 0.2)',
                    },
                    {
                        "label": "Despesas (AOA)",
                        "data": [800000, 850000, 900000], # Sample data
                        "borderColor": 'rgba(255, 99, 132, 1)',
                        "backgroundColor": 'rgba(255, 99, 132, 0.2)',
                    }
                ]
            }
        }
        add_ai_forecast(sample_gemini_response) # Store the sample forecast
        return jsonify(sample_gemini_response), 200

    try:
        transactions_data = get_transactions() # Fetch all for now
        if not transactions_data:
            return jsonify({"error": "No transactions available for analysis"}), 400

        formatted_transactions = []
        for t in transactions_data:
            formatted_transactions.append({
                "date": t["data_pagamento"].split("T")[0] if isinstance(t.get("data_pagamento"), str) else t.get("data_pagamento").isoformat().split("T")[0],
                "type": t["tipo"],
                "description": t["descricao"],
                "amount": t["valor"]
            })

        prompt = f"""
Analyze the following financial transactions from Angola and provide a cash flow forecast for the next 3 months.
The current date is {datetime.now().strftime('%Y-%m-%d')}.
Data:
{json.dumps(formatted_transactions, indent=2)}

Please return the analysis in JSON format with the following structure:
{{
    "cash_flow_forecast": {{
        "next_month_prediction_AOA": <value>,
        "three_month_total_AOA": <value>,
        "trend_description": "<textual description of the trend>",
        "confidence_score": <0.0 to 1.0>
    }},
    "improvement_tips": [
        "<actionable tip 1>",
        "<actionable tip 2>"
    ],
    "evaluation_percentages": {{
        "income_vs_expense_ratio": "<percentage>%",
        "savings_rate_forecast": "<percentage>%",
        "key_expense_categories": {{
            "<category1>": "<percentage>%",
            "<category2>": "<percentage>%"
        }}
    }},
    "currency": "AOA",
    "chart_data": {{
        "labels": ["<Previous Month Name>", "<Current Month Name>", "<Next Month Name (Forecast)>"],
        "datasets": [
            {{
                "label": "Receitas (AOA)",
                "data": [<previous_month_income_value>, <current_month_income_value>, <next_month_forecasted_income_value>],
                "borderColor": "rgba(75, 192, 192, 1)",
                "backgroundColor": "rgba(75, 192, 192, 0.2)"
            }},
            {{
                "label": "Despesas (AOA)",
                "data": [<previous_month_expense_value>, <current_month_expense_value>, <next_month_forecasted_expense_value>],
                "borderColor": "rgba(255, 99, 132, 1)",
                "backgroundColor": "rgba(255, 99, 132, 0.2)"
            }}
        ]
    }}
}}
Ensure all monetary values are in AOA. Provide realistic example values for the chart_data section based on the overall forecast.
The chart_data labels should reflect past, current, and future months relative to the analysis date.
"""
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
        
        # Clean the response: Gemini might wrap JSON in ```json ... ```
        cleaned_response_text = response.text.strip()
        if cleaned_response_text.startswith("```json"):
            cleaned_response_text = cleaned_response_text[7:]
        if cleaned_response_text.endswith("```"):
            cleaned_response_text = cleaned_response_text[:-3]
        
        ai_analysis_result = json.loads(cleaned_response_text)

        # Store the AI analysis
        forecast_id = add_ai_forecast(ai_analysis_result)
        if not forecast_id:
            app.logger.error("Failed to store AI forecast.")
            # Decide if you want to return an error or the result anyway
            # return jsonify({"error": "Failed to store AI analysis"}), 500

        return jsonify(ai_analysis_result), 200

    except Exception as e:
        app.logger.error(f"Error calling Gemini API or processing its response: {e}")
        # Fallback to sample if actual API call fails for unexpected reasons
        return jsonify({
            "error": "Failed to get analysis from AI. Using sample data.",
            "details": str(e),
            "sample_data": { # Providing sample data on error
                "cash_flow_forecast": {
                    "next_month_prediction_AOA": 50000.0, "three_month_total_AOA": 150000.0,
                    "trend_description": "Error fetching real data.", "confidence_score": 0.1
                },
                "improvement_tips": ["Check API key and network."],
                "evaluation_percentages": {"income_vs_expense_ratio": "N/A"}, "currency": "AOA",
                "chart_data": { "labels": ["M1", "M2", "M3"], "datasets": []}
            }
        }), 500


# --- Routes to Serve Tab HTML and Static Files ---

@app.route('/')
def home():
    return send_from_directory('previsao_fluxo_ai', 'index.html')

@app.route('/previsao_fluxo_ai/')
def previsao_fluxo_ai_index():
    return send_from_directory('previsao_fluxo_ai', 'index.html')

@app.route('/previsao_fluxo_ai/<path:filename>')
def previsao_fluxo_ai_static(filename):
    return send_from_directory('previsao_fluxo_ai', filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)


# --- Routes for Tab 2: FraudGuard AI ---
@app.route('/fraudguard_ai/')
def fraudguard_ai_index():
    return send_from_directory('fraudguard_ai', 'index.html')

@app.route('/fraudguard_ai/<path:filename>')
def fraudguard_ai_static(filename):
    return send_from_directory('fraudguard_ai', filename)

# --- API Endpoint for Fraud Detection ---
@app.route('/api/detect_fraud', methods=['POST'])
def api_detect_fraud():
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        app.logger.warn("Gemini API key not configured. Returning sample fraud detection report.")
        # Simulate Gemini response structure for fraud detection
        sample_fraud_response = {
            "fraud_report": [
                {
                    "transaction_id": "sample_txn_1", # Replace with actual ID if testing with real data
                    "is_suspicious": True,
                    "reason": "Unusually large transaction amount compared to typical spending patterns.",
                    "risk_score": 0.85,
                    "recommended_action": "Review manually"
                },
                {
                    "transaction_id": "sample_txn_2",
                    "is_suspicious": True,
                    "reason": "Transaction with a new payee in a high-risk category.",
                    "risk_score": 0.65,
                    "recommended_action": "Monitor payee activity"
                }
            ],
            "summary": {
                "total_transactions_scanned": 20, # Example count
                "suspicious_transactions_found": 2,
                "overall_risk_level": "Medium"
            },
            "currency": "AOA"
        }
        # In a real scenario, you would update the transactions based on this report.
        # For sample, we're just returning it.
        return jsonify(sample_fraud_response), 200

    try:
        # Fetch recent transactions (e.g., last 30 days, or those not yet scanned for fraud)
        # For this example, let's fetch all transactions.
        # In a real app, you'd have more specific filtering.
        transactions_to_analyze = get_transactions() 

        if not transactions_to_analyze:
            return jsonify({"message": "No transactions found to analyze."}), 200

        formatted_transactions_for_prompt = []
        for t in transactions_to_analyze:
            formatted_transactions_for_prompt.append({
                "id": str(t["_id"]), # Ensure ID is a string
                "date": t["data_pagamento"].split("T")[0] if isinstance(t.get("data_pagamento"), str) else t.get("data_pagamento").isoformat().split("T")[0],
                "description": t["descricao"],
                "amount": t["valor"],
                "type": t["tipo"]
            })

        prompt = f"""
Analyze the following financial transactions from Angola for potential fraudulent activity. 
For each transaction identified as suspicious, provide a reason, a risk score (0-1), and a recommended action.
Data:
{json.dumps(formatted_transactions_for_prompt, indent=2)}

Please return the analysis in JSON format:
{{
    "fraud_report": [
        {{
            "transaction_id": "<original_transaction_id>",
            "is_suspicious": <true_or_false>,
            "reason": "<explanation_if_suspicious>",
            "risk_score": <0.0_to_1.0_if_suspicious_else_0.0>,
            "recommended_action": "<e.g., Review manually, Block account, No action needed>"
        }}
        // Include entries for ALL transactions scanned, marking non-suspicious ones appropriately.
    ],
    "summary": {{
        "total_transactions_scanned": <count>,
        "suspicious_transactions_found": <count>,
        "overall_risk_level": "<Low/Medium/High based on findings>"
    }},
    "currency": "AOA"
}}
Ensure all monetary values are in AOA.
The transaction_id in the report must match the original _id from the input.
"""
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
        
        cleaned_response_text = response.text.strip()
        if cleaned_response_text.startswith("```json"):
            cleaned_response_text = cleaned_response_text[7:]
        if cleaned_response_text.endswith("```"):
            cleaned_response_text = cleaned_response_text[:-3]
        
        fraud_analysis_result = json.loads(cleaned_response_text)

        # Update transactions in DB with fraud analysis
        if fraud_analysis_result.get("fraud_report"):
            for report_item in fraud_analysis_result["fraud_report"]:
                txn_id = report_item.get("transaction_id")
                if txn_id:
                    # Prepare the update for the ai_analysis_results field
                    update_data = {
                        "ai_analysis_results.fraud_guard": {
                            "is_suspicious": report_item.get("is_suspicious"),
                            "reason": report_item.get("reason"),
                            "risk_score": report_item.get("risk_score"),
                            "recommended_action": report_item.get("recommended_action"),
                            "last_scanned_at": datetime.utcnow().isoformat()
                        }
                    }
                    # The update_transaction function needs to handle dot notation for subdocuments
                    update_transaction(txn_id, update_data) 
        
        return jsonify(fraud_analysis_result), 200

    except Exception as e:
        app.logger.error(f"Error in fraud detection API: {e}")
        # Fallback to sample if actual API call fails
        return jsonify({
            "error": "Failed to get fraud analysis from AI. Using sample data.",
            "details": str(e),
            "sample_data": { # Providing sample data on error
                 "fraud_report": [],
                 "summary": {"total_transactions_scanned": 0, "suspicious_transactions_found": 0, "overall_risk_level": "Error"},
                 "currency": "AOA"
            }
        }), 500

# --- File Upload Endpoint ---
ALLOWED_EXTENSIONS = {'csv', 'xlsx'}


# --- Routes for Tab 3: SmartCredit AI ---
@app.route('/smartcredit_ai/')
def smartcredit_ai_index():
    return send_from_directory('smartcredit_ai', 'index.html')

@app.route('/smartcredit_ai/<path:filename>')
def smartcredit_ai_static(filename):
    return send_from_directory('smartcredit_ai', filename)

# --- API Endpoint for Credit Analysis ---
@app.route('/api/analyze_credit', methods=['POST'])
def api_analyze_credit():
    # Ensure add_credit_report is imported from database
    from database import add_credit_report
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        app.logger.warn("Gemini API key not configured. Returning sample credit analysis.")
        sample_credit_response = {
            "credit_analysis_report": {
                "credit_score": "Good (7/10)",
                "recommended_credit_limit_AOA": 750000.00,
                "key_positive_factors": [
                    "Consistent income stream noted over the past 6 months.",
                    "Positive net cash flow on average."
                ],
                "key_negative_factors": [
                    "Occasional high-value expense spikes.",
                    "Limited history of managing large debts (if applicable based on data)."
                ],
                "assessment_summary": "The entity shows a generally positive financial health with good repayment capacity. Credit limit recommended with standard caution.",
                "confidence_level": "Medium"
            },
            "currency": "AOA"
        }
        # Store this sample report
        add_credit_report(sample_credit_response["credit_analysis_report"])
        return jsonify(sample_credit_response), 200

    try:
        transactions = get_transactions() # Fetch all transactions for the entity
        if not transactions:
            return jsonify({"error": "No transactions available for credit analysis"}), 400

        # Calculate financial summary (simplified example)
        total_income_last_6m = 0
        total_expenses_last_6m = 0
        # Assuming transactions have 'data_pagamento' as string ISO dates, convert to datetime for comparison
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        
        # Filter transactions for the last 6 months and calculate income/expenses
        # This requires 'data_pagamento' to be datetime objects or comparable strings
        # For simplicity, if 'data_pagamento' is already a string from DB, we might need to parse it.
        # The current get_transactions returns them as ISO strings.

        recent_transactions_for_summary = []
        transaction_highlights = []

        for t in transactions:
            try:
                transaction_date = datetime.fromisoformat(t['data_pagamento'].split('T')[0])
                if transaction_date > six_months_ago:
                    recent_transactions_for_summary.append(t)
                    if t['tipo'] == 'receita':
                        total_income_last_6m += t['valor']
                    elif t['tipo'] == 'despesa':
                        total_expenses_last_6m += t['valor']
            except ValueError:
                app.logger.warn(f"Could not parse date for transaction {t['_id']}")
                continue # Skip transactions with unparseable dates

        # Select a few transaction highlights (e.g., last 5 significant ones)
        # Sorting by date and then by amount could be one way.
        # For simplicity, just taking last 5 processed if available
        transactions_sorted_by_date = sorted(recent_transactions_for_summary, key=lambda x: x['data_pagamento'], reverse=True)
        for t_highlight in transactions_sorted_by_date[:5]:
             transaction_highlights.append({
                 "date": t_highlight['data_pagamento'].split("T")[0],
                 "type": t_highlight['tipo'],
                 "description": t_highlight['descricao'],
                 "amount": f"{t_highlight['valor']} AOA"
             })


        # Simplified Debt-to-Income (DTI) - assuming total_income_last_6m is gross income for the period
        # And total_expenses_last_6m includes debt payments. This is a very rough estimate.
        dti_ratio_percentage = "N/A"
        if total_income_last_6m > 0:
            # This isn't a true DTI, more like expense ratio. True DTI needs specific debt payment data.
            dti_ratio_percentage = f"{(total_expenses_last_6m / total_income_last_6m) * 100:.2f}% (Expense Ratio)"
        
        # Average monthly balance - this is complex and needs historical balance data, not just transactions.
        # For now, we'll use a placeholder or a very simplified calculation.
        # Placeholder for average_monthly_balance
        average_monthly_balance_AOA = (total_income_last_6m - total_expenses_last_6m) / 6 if total_income_last_6m > 0 else 0


        financial_summary = {
            "total_income_last_6m_AOA": total_income_last_6m,
            "total_expenses_last_6m_AOA": total_expenses_last_6m,
            "net_cash_flow_last_6m_AOA": total_income_last_6m - total_expenses_last_6m,
            "calculated_expense_to_income_ratio": dti_ratio_percentage,
            "average_monthly_net_flow_AOA": average_monthly_balance_AOA, # Placeholder name
            "number_of_transactions_last_6m": len(recent_transactions_for_summary)
        }

        prompt = f"""
Perform an automatic credit analysis based on the following financial data for an entity in Angola.
Provide a credit score (e.g., a category like Poor, Fair, Good, Excellent, and a 1-10 rating), a recommended credit limit in AOA, and key factors influencing the decision.

Financial Summary (last 6 months):
{json.dumps(financial_summary, indent=2)}

Transaction History Highlights (last 6 months, up to 5 transactions):
{json.dumps(transaction_highlights, indent=2)}

Please return the analysis in JSON format:
{{
    "credit_analysis_report": {{
        "credit_score": "<e.g., Good (7/10)>",
        "recommended_credit_limit_AOA": <value_float_or_int>,
        "key_positive_factors": ["<factor 1>", "<factor 2>"],
        "key_negative_factors": ["<factor 1>"],
        "assessment_summary": "<textual summary of the creditworthiness and financial stability>",
        "confidence_level": "<High/Medium/Low>"
    }},
    "currency": "AOA"
}}
Ensure all monetary values are in AOA. Base your assessment on typical Angolan business context if possible.
Focus on financial stability, income consistency, expense management, and cash flow patterns.
The recommended_credit_limit_AOA should be a numerical value.
"""
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
        
        cleaned_response_text = response.text.strip()
        if cleaned_response_text.startswith("```json"):
            cleaned_response_text = cleaned_response_text[7:]
        if cleaned_response_text.endswith("```"):
            cleaned_response_text = cleaned_response_text[:-3]
        
        credit_analysis_result_full = json.loads(cleaned_response_text)
        credit_analysis_report_data = credit_analysis_result_full.get("credit_analysis_report")

        if credit_analysis_report_data:
            # Store the AI credit analysis report
            report_id = add_credit_report(credit_analysis_report_data)
            if not report_id:
                app.logger.error("Failed to store AI credit report.")
                # Decide if this is a critical error
        else:
            app.logger.error("Gemini response did not contain 'credit_analysis_report' field.")
            # Fallback or error
            return jsonify({"error": "AI response missing 'credit_analysis_report' field."}), 500
        
        return jsonify(credit_analysis_result_full), 200 # Return the full original response

    except Exception as e:
        app.logger.error(f"Error in credit analysis API: {e}")
        # Fallback to sample if actual API call fails
        return jsonify({
            "error": "Failed to get credit analysis from AI. Using sample data.",
            "details": str(e),
            "sample_data": { # Providing sample data on error
                 "credit_analysis_report": {
                    "credit_score": "Error Processing (0/10)",
                    "recommended_credit_limit_AOA": 0,
                    "key_positive_factors": ["Error in processing"],
                    "key_negative_factors": [str(e)],
                    "assessment_summary": "Could not complete credit assessment due to an internal error.",
                    "confidence_level": "Low"
                },
                "currency": "AOA"
            }
        }), 500

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload_transactions', methods=['POST'])
def upload_transactions_file():
    if 'transaction_file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['transaction_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = file.filename # Secure filename can be used here if needed
        
        try:
            if filename.endswith('.csv'):
                # For CSV, try to infer encoding, common ones are utf-8 and latin1
                try:
                    df = pd.read_csv(file.stream, encoding='utf-8')
                except UnicodeDecodeError:
                    file.stream.seek(0) # Reset stream position
                    df = pd.read_csv(file.stream, encoding='latin1')
            elif filename.endswith('.xlsx'):
                df = pd.read_excel(file.stream, engine='openpyxl')
            else:
                return jsonify({"error": "Unsupported file type"}), 400

            # Normalize column names (example: 'Data de Pagamento' to 'data_de_pagamento')
            original_columns = df.columns.tolist()
            df.columns = df.columns.str.lower().str.replace(' ', '_').str.replace('-', '_')
            
            # Define expected columns based on the normalized names
            # The issue mentions 'data-de-pagamento', which normalizes to 'data_de_pagamento'
            required_columns_normalized = ['tipo', 'descricao', 'valor', 'data_de_pagamento', 'status']
            
            missing_cols = [col for col in required_columns_normalized if col not in df.columns]
            if missing_cols:
                return jsonify({
                    "error": f"Missing required columns in file after normalization: {', '.join(missing_cols)}. Original columns found: {original_columns}"
                }), 400

            imported_count = 0
            errors = []

            for index, row in df.iterrows():
                try:
                    # Use .get(column_name, default_value) for robustness if a column might sometimes be missing
                    # despite the check above, or handle NaN values explicitly.
                    tipo = str(row.get('tipo', '')).strip().lower()
                    descricao = str(row.get('descricao', '')).strip()
                    valor_raw = row.get('valor')
                    data_pagamento_raw = row.get('data_de_pagamento')
                    status = str(row.get('status', '')).strip().lower()

                    if pd.isna(valor_raw) or valor_raw == '':
                        errors.append(f"Row {index + 2}: 'valor' is missing.")
                        continue
                    try:
                        valor = float(valor_raw)
                    except ValueError:
                        errors.append(f"Row {index + 2}: 'valor' ({valor_raw}) is not a valid number.")
                        continue
                    
                    if pd.isna(data_pagamento_raw) or data_pagamento_raw == '':
                        errors.append(f"Row {index + 2}: 'data_de_pagamento' is missing.")
                        continue
                    try:
                        # Pandas to_datetime can infer various formats; specify if a particular format is expected
                        data_pagamento = pd.to_datetime(data_pagamento_raw).to_pydatetime()
                    except Exception as e_date:
                        errors.append(f"Row {index + 2}: 'data_de_pagamento' ({data_pagamento_raw}) is not a valid date or format. Error: {e_date}")
                        continue

                    if not tipo: errors.append(f"Row {index + 2}: 'tipo' is missing."); continue
                    if not descricao: errors.append(f"Row {index + 2}: 'descricao' is missing."); continue
                    if not status: errors.append(f"Row {index + 2}: 'status' is missing."); continue


                    transaction_data = {
                        "tipo": tipo,
                        "descricao": descricao,
                        "valor": valor,
                        "data_pagamento": data_pagamento,
                        "status": status
                        # ai_analysis_results is initialized by add_transaction
                    }
                    
                    if transaction_data['tipo'] not in ['receita', 'despesa']:
                        errors.append(f"Row {index + 2}: Invalid 'tipo': {transaction_data['tipo']}. Must be 'receita' or 'despesa'.")
                        continue
                    if transaction_data['status'] not in ['pago', 'pendente', 'agendado']:
                        errors.append(f"Row {index + 2}: Invalid 'status': {transaction_data['status']}. Must be 'pago', 'pendente', or 'agendado'.")
                        continue
                    
                    add_transaction(transaction_data) # This function already initializes "ai_analysis_results"
                    imported_count += 1
                except Exception as e_row:
                    errors.append(f"Row {index + 2}: Error processing row - {str(e_row)}")
            
            response_message = ""
            if imported_count > 0:
                response_message = f"{imported_count} transactions imported successfully."
            
            if errors:
                if imported_count > 0:
                    return jsonify({"message": response_message, "errors": errors}), 207 # Multi-Status
                else:
                    return jsonify({"error": "Failed to import any transactions. See errors.", "errors": errors}), 400
            elif imported_count == 0:
                 return jsonify({"message": "No transactions found or processed in the file."}), 200
            
            return jsonify({"message": response_message}), 200

        except pd.errors.EmptyDataError:
            return jsonify({"error": "The uploaded file is empty."}), 400
        except Exception as e_file:
            app.logger.error(f"Error processing uploaded file: {e_file}")
            return jsonify({"error": f"An error occurred while processing the file: {str(e_file)}"}), 500
    else:
        return jsonify({"error": "File type not allowed. Please upload CSV or XLSX."}), 400
