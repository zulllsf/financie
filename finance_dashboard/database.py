import os
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId
from datetime import datetime

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
# MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME") # Not used directly here, but good to have loaded

# Expected document structure:
# {
#   "tipo": "string",  // e.g., "receita", "despesa"
#   "descricao": "string", // "Salary", "Office Supplies"
#   "valor": "float", // Amount in AOA
#   "data_pagamento": "ISODate", // Payment date
#   "status": "string", // e.g., "pago", "pendente", "agendado"
#   "created_at": "ISODate", // Timestamp of record creation
#   "ai_analysis_results": { // To store results from Gemini
#     "cash_flow_forecast": { ... },
#     "fraud_detection_report": { ... },
#     // etc.
#   }
# }

client = None
db = None

def get_db():
    global client, db
    if client is None:
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
    return db

def get_collection(collection_name: str):
    db_instance = get_db()
    return db_instance[collection_name]

def add_transaction(data: dict):
    """
    Adds a transaction to the 'transactions' collection.
    """
    collection = get_collection("transactions")
    data["created_at"] = datetime.utcnow()
    data["ai_analysis_results"] = {} # Initialize ai_analysis_results
    result = collection.insert_one(data)
    return result.inserted_id

def get_transactions(filters: dict = None):
    """
    Retrieves transactions from the 'transactions' collection.
    Accepts an optional filters dictionary.
    """
    if filters is None:
        filters = {}
    collection = get_collection("transactions")
    return list(collection.find(filters))

def get_transaction_by_id(transaction_id: str):
    """
    Retrieves a single transaction by its ID.
    """
    collection = get_collection("transactions")
    try:
        return collection.find_one({"_id": ObjectId(transaction_id)})
    except Exception:
        return None

def update_transaction(transaction_id: str, updates: dict):
    """
    Updates a specific transaction identified by transaction_id.
    """
    collection = get_collection("transactions")
    result = collection.update_one({"_id": ObjectId(transaction_id)}, {"$set": updates})
    return result.modified_count > 0

def add_ai_forecast(forecast_data: dict):
    """
    Adds an AI forecast to the 'ai_forecasts' collection.
    """
    collection = get_collection("ai_forecasts")
    forecast_data["created_at"] = datetime.utcnow()
    result = collection.insert_one(forecast_data)
    return result.inserted_id

def get_latest_ai_forecast():
    """
    Retrieves the most recent AI forecast from the 'ai_forecasts' collection.
    """
    collection = get_collection("ai_forecasts")
    # Find the most recent document by sorting by 'created_at' in descending order
    latest_forecast = collection.find_one(sort=[("created_at", -1)])
    return latest_forecast

# Example usage (optional - for testing)
if __name__ == '__main__':
    # Ensure MongoDB is running and .env is configured
    print(f"Connecting to MongoDB: {MONGO_URI}, DB: {MONGO_DB_NAME}")

    db_instance = get_db()
    print(f"Database object: {db_instance}")

    # Test adding a transaction
    # sample_transaction = {
    #     "tipo": "receita",
    #     "descricao": "Freelance Project",
    #     "valor": 1500.00,
    #     "data_pagamento": datetime(2024, 7, 20),
    #     "status": "pendente",
    #     "ai_analysis_results": {}
    # }
    # inserted_id = add_transaction(sample_transaction)
    # print(f"Inserted transaction ID: {inserted_id}")

    # Test retrieving transactions
    # all_transactions = get_transactions()
    # print(f"All transactions: {all_transactions}")

    # Test AI forecast functions
    # sample_forecast = {
    #     "cash_flow_forecast": {"next_month_prediction_AOA": 2000000},
    #     "improvement_tips": ["Save more!"],
    #     "evaluation_percentages": {"savings_rate_forecast": "10%"}
    # }
    # forecast_id = add_ai_forecast(sample_forecast)
    # print(f"Inserted AI forecast ID: {forecast_id}")

    # latest_f = get_latest_ai_forecast()
    # print(f"Latest AI forecast: {latest_f}")

    # Test credit report functions
    # sample_credit_report = {
    #     "credit_score": "Good (7/10)",
    #     "recommended_credit_limit_AOA": 500000,
    #     "key_positive_factors": ["Consistent income"],
    #     "key_negative_factors": ["High recent expenses"]
    # }
    # report_id = add_credit_report(sample_credit_report)
    # print(f"Inserted credit report ID: {report_id}")
    # latest_cr = get_latest_credit_report()
    # print(f"Latest credit report: {latest_cr}")
    pass

def add_credit_report(report_data: dict):
    """
    Adds a credit analysis report to the 'ai_credit_reports' collection.
    """
    collection = get_collection("ai_credit_reports")
    report_data["created_at"] = datetime.utcnow()
    result = collection.insert_one(report_data)
    return result.inserted_id

def get_latest_credit_report():
    """
    Retrieves the most recent credit analysis report from the 'ai_credit_reports' collection.
    """
    collection = get_collection("ai_credit_reports")
    latest_report = collection.find_one(sort=[("created_at", -1)])
    return latest_report

def add_risk_report(report_data: dict):
    """
    Adds a risk analysis report to the 'ai_risk_reports' collection.
    """
    collection = get_collection("ai_risk_reports")
    report_data["created_at"] = datetime.utcnow() # Ensure timestamp is part of the main report document
    result = collection.insert_one(report_data)
    return result.inserted_id

def get_latest_risk_report():
    """
    Retrieves the most recent risk analysis report from the 'ai_risk_reports' collection.
    """
    collection = get_collection("ai_risk_reports")
    latest_report = collection.find_one(sort=[("created_at", -1)])
    return latest_report
