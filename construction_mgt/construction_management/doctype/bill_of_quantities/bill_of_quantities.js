// Copyright (c) 2024, Byoosi.com and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bill of Quantities", {
    before_save: function(frm) {
        summarizeBoQ(frm);
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
