import frappe
from frappe import _
from frappe.utils import flt

# trying to test github
@frappe.whitelist()
def fetch_item_rate(item_code, price_list):
    item_price = frappe.get_value('Item Price', {'item_code': item_code, 'price_list': price_list}, 'price_list_rate')
    return item_price if item_price else 0
   