import frappe
from frappe.utils import flt

def update_material_schedule_on_cancel(doc, method=None):
    # Fetch the Material Request document
    material_request = frappe.get_doc("Material Request", doc.name)
    
    schedule_name = material_request.custom_schedule
    
    if not schedule_name:
        frappe.throw("Material Schedule is not specified in the Material Request.")
    
    # Fetch the Material Schedule document
    schedule = frappe.get_doc("Material Schedule", schedule_name)
    
    if not schedule.activities:
        frappe.throw("No activities found in the Material Schedule.")
    
    task_section_amounts = {}

    # Sum the amounts from the canceled Material Request items
    for item in material_request.items:
        key = f"{item.custom_activity}-{item.custom_section}"
        if key not in task_section_amounts:
            task_section_amounts[key] = 0
        task_section_amounts[key] += flt(item.amount)
    
    # Debugging: Log the amounts to be added back
    frappe.logger().debug(f"Task Section Amounts to Add Back: {task_section_amounts}")

    # Add the amounts back to the Material Schedule
    for activity in schedule.activities:
        key = f"{activity.task}-{activity.section}"
        if key in task_section_amounts:
            activity.amount += flt(task_section_amounts[key])
    
    # Save the updated Material Schedule
    schedule.save()
    frappe.db.commit()
    
    # Debugging: Log success message
    frappe.logger().debug(f"Material Schedule {schedule_name} updated successfully.")



@frappe.whitelist()
def create_purchase_orders_and_expense_claims(material_request_name):
    try:
        doc = frappe.get_doc('Material Request', material_request_name)
        
        # Create Purchase Orders and Expense Claims based on child table items
        create_purchase_orders(doc)
        create_expense_claims(doc)
    
    except Exception as e:
        frappe.log_error(f"Error in create_purchase_orders_and_expense_claims: {str(e)}", "Purchase Order/Expense Claim Creation")

@frappe.whitelist()
def create_purchase_orders(doc):
    try:
        for item in doc.items:
            if item.custom_pay_priority == "Pay Now" and item.custom_supplier_employee == "Supplier":
                po = frappe.new_doc('Purchase Order')
                po.supplier = item.custom_party
                po.custom_material_request_id = doc.name
                po.transaction_date = doc.transaction_date
                po.schedule_date = doc.schedule_date
                
                po.append('items', {
                    'item_code': item.item_code,
                    'schedule_date': item.schedule_date,
                    'qty': flt(item.qty),
                    'uom': item.uom,
                    'rate': flt(item.rate),
                    'material_request': doc.name
                })
                
                po.insert()
                po.submit()
    
    except Exception as e:
        frappe.log_error(f"Error in create_purchase_orders: {str(e)}", "Purchase Order Creation")

@frappe.whitelist()
def create_expense_claims(doc):
    try:
        employees = set()
        for item in doc.items:
            if item.custom_pay_priority == "Pay Now" and item.custom_supplier_employee == "Employee":
                employees.add(item.custom_party)
        
        for employee in employees:
            create_expense_claim(doc, employee)
    
    except Exception as e:
        frappe.log_error(f"Error in create_expense_claims: {str(e)}", "Expense Claim Creation")

@frappe.whitelist()
def create_expense_claim(doc, employee): 
    try:
        expense_claim = frappe.new_doc('Expense Claim')
        expense_claim.employee = employee
        
        # Fetch department and approvers 
        department = frappe.get_doc('Employee', employee).department
        approver = frappe.get_doc('Department', department)
        user_approver = approver.expense_approvers[0].approver if approver.expense_approvers else None
        
        expense_claim.expense_approver = user_approver
        expense_claim.custom_material_request_id = doc.name
        expense_claim.project = doc.custom_project_name
        expense_claim.posting_date = doc.schedule_date
        expense_claim.payable_account = "2110 - Creditors - RIL "
        
        for item in doc.items:
            if item.custom_party == employee and item.custom_pay_priority == "Pay Now":
                expense_claim.append('expenses', {
                    'expense_type': item.item_code,
                    'amount': flt(item.qty * item.rate),
                    'sanctioned_amount': flt(item.qty * item.rate),
                    'cost_center': item.cost_center,
                    'project': doc.custom_project_name,
                    'description': item.custom_activity_name,
                })
        
        expense_claim.insert()
        # expense_claim.submit()
    
    except Exception as e:
        frappe.log_error(f"Error in create_expense_claim: {str(e)}", "Expense Claim Creation")
