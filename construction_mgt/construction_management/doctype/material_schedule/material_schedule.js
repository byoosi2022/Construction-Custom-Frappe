// Copyright (c) 2024, Byoosi.com and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Material Schedule", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Material Schedule', {
    grand_total: function(frm) {
        summarizeMatSch(frm);
    },
    validate: function(frm) {
        // Fetch BoQ and validate amounts
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Bill of Quantities',
                name: frm.doc.boq
            },
            callback: function(r) {
                if (r.message.summary_of_the_section) {
                    console.log(r.message.summary_of_the_section);
                    validate_material_schedule(frm, r.message);
                }
            }
        });
    }
});

function validate_material_schedule(frm, boq) {
    var summary = {};

    frm.doc.items.forEach(function (item) {
        if (!summary[item.section]) {
            summary[item.section] = {
                section: item.section,
                amount: 0
            };
        }
        summary[item.section].amount += item.amount;
    });

    // Loop through the summary and validate amounts
    Object.keys(summary).forEach(function (key) {
        let task_type = summary[key].section;
        let amount = summary[key].amount;

        let boq_section = boq.summary_of_the_section.find(section => section.task_type === task_type);
        if (boq_section) {
            if (amount > boq_section.amount) {
                frappe.msgprint(`The total amount for section ${task_type} exceeds the BoQ amount ${boq_section.amount}. Please adjust the quantities.`);
                frappe.validated = false;
            }
        }
    });
}



frappe.ui.form.on('Material Schedule Items', {
    amount: function (frm, cdt, cdn) {
        calculateTotalsMATSCH(frm);
    },
    quantity_required: function (frm, cdt, cdn) {
        calculateTotalsMATSCH(frm);
    },
    rate: function (frm, cdt, cdn) {
        calculateTotalsMATSCH(frm);
    },
    item: function (frm, cdt, cdn) {
        calculateTotalsMATSCH(frm);
        fetch_price(frm);
    }
});

function fetch_price(frm) {
    frm.doc.items.forEach(function (item) {
        frappe.call({
            method: "construction_mgt.custom_api.fetch_item_price.fetch_item_rate",
            args: {
                item_code: item.item,
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

function calculateTotalsMATSCH(frm) {
    frm.set_value('grand_total', "");
    frm.set_value('total_qty', "");
    var total_amount = 0;
    var total_qty = 0;
    frm.doc.items.forEach(function (item) {
        item.amount = item.rate * item.quantity_required;
        total_amount += item.amount;
        total_qty += item.quantity_required;
    });
    frm.set_value('grand_total', total_amount);
    frm.set_value('total_qty', total_qty);
    refresh_field('items'); 
}

// section

function summarizeMatSch(frm) {
    var summary = {};

    frm.doc.items.forEach(function (item) {
        if (!summary[item.activity]) {
            summary[item.activity] = {
                activity: item.activity,
                section: item.section,
                amount: 0
            };
        }
        summary[item.activity].amount += item.amount;
    });

    // Clear existing summary items
    frm.clear_table('activities');

    // Populate the summary_of_the_section table
    Object.keys(summary).forEach(function (key) {
        var row = frm.add_child('activities');
        row.task = summary[key].activity;
        row.section = summary[key].section;
        row.amount = summary[key].amount;
    });

    refresh_field('activities');
}