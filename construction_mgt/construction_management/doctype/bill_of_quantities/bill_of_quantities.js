// Copyright (c) 2024, Byoosi.com and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bill of Quantities", {
    before_save: function(frm) {
        summarizeBoQ(frm);
    },
    refresh: function(frm) {
        frm.add_custom_button(__('Create Material Schedule'), function() {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Material Schedule',
                    filters: {
                        'boq': frm.doc.name
                    },
                    limit_page_length: 1
                },
                callback: function(response) {
                    if (response.message && response.message.length > 0) {
                        // Existing Material Schedule found, route to it
                        frappe.set_route('Form', 'Material Schedule', response.message[0].name);
                    } else {
                        // No existing Material Schedule, create a new one 
                        frappe.model.with_doctype('Material Schedule', function() {
                            var lse = frappe.model.get_new_doc('Material Schedule');
                            lse.boq = frm.doc.name;
                            lse.project_name = frm.doc.project_name;
                            lse.company = frm.doc.company;
                            lse.project_location = frm.doc.project_location;
                            lse.client = frm.doc.client;
                            lse.consultant = frm.doc.consultant;
                            lse.quantity_surveyor = frm.doc.quantity_surveyor__name;
                            lse.date = frm.doc.date;
                            lse.price_list = frm.doc.price_list;
        
                            // Copy items from Purchase Invoice to Commission Voucher
                            frm.doc.boq_detail.forEach(function(item) {
                                var voucher_detail = frappe.model.add_child(lse, 'Material Schedule Items', 'items');
                                voucher_detail.section = item.task_type;
                                voucher_detail.rate = item.rate;
                                voucher_detail.amount = item.amount;
                                voucher_detail.activity = item.task;
                                voucher_detail.item = item.item_code;
                                voucher_detail.quantity_required = item.qty;
                            });
        
                            frappe.set_route('Form', 'Material Schedule', lse.name);
                        });
                    }
                }
            });
        }, __("Create"));
        

        
    }
});


frappe.ui.form.on('BoQ Item', {
    amount: function (frm, cdt, cdn) {
        calculateTotalsBOQ(frm);
    },
    qty: function (frm, cdt, cdn) {
        calculateTotalsBOQ(frm);
    },
    rate: function (frm, cdt, cdn) {
        calculateTotalsBOQ(frm);
    },
    item_code: function (frm, cdt, cdn) {
        calculateTotalsBOQ(frm);
        fetch_price(frm);
    }
});

function fetch_price(frm) {
    frm.doc.boq_detail.forEach(function (item) {
        frappe.call({
            method: "construction_mgt.custom_api.fetch_item_price.fetch_item_rate",
            args: {
                item_code: item.item_code,
                price_list: frm.doc.price_list
            },
            callback: function(response) {
                if (response.message) {
                    frappe.model.set_value(item.doctype, item.name, 'rate', response.message);
                }
            }
        });
    });
}

function calculateTotalsBOQ(frm) {
    frm.set_value('grand_totals', "");
    frm.set_value('total_qty', "");
    var total_amount = 0;
    var total_qty = 0;
    frm.doc.boq_detail.forEach(function (item) {
        item.amount = item.rate * item.qty;
        total_amount += item.amount;
        total_qty += item.qty;
    });
    frm.set_value('grand_totals', total_amount);
    frm.set_value('total_qty', total_qty);
    refresh_field('boq_detail');
}

function summarizeBoQ(frm) {
    var summary = {};

    frm.doc.boq_detail.forEach(function (item) {
        if (!summary[item.task_type]) {
            summary[item.task_type] = {
                task_type: item.task_type,
                amount: 0
            };
        }
        summary[item.task_type].amount += item.amount;
    });

    // Clear existing summary items
    frm.clear_table('summary_of_the_section');

    // Populate the summary_of_the_section table
    Object.keys(summary).forEach(function (key) {
        var row = frm.add_child('summary_of_the_section');
        row.task_type = summary[key].task_type;
        row.amount = summary[key].amount;
    });

    refresh_field('summary_of_the_section');
}

