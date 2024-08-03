frappe.ui.form.on('Material Request', {
    validate: function(frm) {
        // Fetch BoQ and validate amounts
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Material Schedule',
                name: frm.doc.custom_schedule
            },
            callback: function(r) {
                if (r.message.activities) {
                    // console.log(r);
                    validate_material_request(frm, r.message.activities);
                }
            }
        });
    },
    on_submit: function(frm) {
        update_material_schedule(frm, 'subtract');
        
        frappe.call({
            method: 'construction_mgt.custom_api.material_request.create_purchase_orders_and_expense_claims',
            args: {
                material_request_name: frm.doc.name
            },
            callback: function (r) {
                console.log(r)
                if (r.exc) {
                    frappe.msgprint(__('An error occurred while processing the request.'));
                } else {
                    // frappe.msgprint(__('Purchase Orders and Expense Claims have been created.'));
                }
            }
        });
    },
});

function validate_material_request(frm, activities) {
    let taskSectionAmounts = {};

    // Loop through items child table and sum the custom_activity amounts
    frm.doc.items.forEach(item => {
        let key = `${item.custom_activity}-${item.custom_section}`;
        if (!taskSectionAmounts[key]) {
            taskSectionAmounts[key] = 0;
        }
        taskSectionAmounts[key] += item.amount;
    });

    // Validate the amounts against the response from the Material Schedule
    for (let key in taskSectionAmounts) {
        let activityData = activities.find(act => `${act.task}-${act.section}` === key);

        if (activityData) {
            if (taskSectionAmounts[key] > activityData.amount) {
                let excessAmount = taskSectionAmounts[key] - activityData.amount;
                frappe.msgprint(`The total amount for activity and section combination ${key} exceeds the allowed amount by ${excessAmount}.`);
                frappe.validated = false;
                return;
            }
        } else {
            frappe.msgprint(`No matching activity and section combination ${key} found in the Material Schedule.`);
            frappe.validated = false;
            return;
        }
    }
}

function update_material_schedule(frm, operation) {
    // Fetch the Material Schedule
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Material Schedule',
            name: frm.doc.custom_schedule
        },
        callback: function(r) {
            if (r.message.activities) {
                let activities = r.message.activities;
                let taskSectionAmounts = {};

                // Loop through items child table and sum the custom_activity amounts
                frm.doc.items.forEach(item => {
                    let key = `${item.custom_activity}-${item.custom_section}`;
                    if (!taskSectionAmounts[key]) {
                        taskSectionAmounts[key] = 0;
                    }
                    taskSectionAmounts[key] += item.amount;
                });

                // Update the amounts in the Material Schedule
                activities.forEach(activity => {
                    let key = `${activity.task}-${activity.section}`;
                    if (taskSectionAmounts[key]) {
                        if (operation === 'subtract') {
                            activity.amount -= taskSectionAmounts[key];
                        }
                    }
                });

                // Save the updated Material Schedule
                frappe.call({
                    method: 'frappe.client.save',
                    args: {
                        doc: r.message
                    },
                    callback: function() {
                        console.log('Material Schedule updated successfully');
                    },
                    error: function(err) {
                        console.error('Error updating Material Schedule:', err);
                    }
                });
            }
        },
        error: function(err) {
            console.error('Error fetching Material Schedule:', err);
        }
    });
}
