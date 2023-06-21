/*
 * Author:               Ankith Ravindran
 * Created on:           Wed Jun 21 2023
 * Modified on:          Wed Jun 21 2023 11:09:41
 * SuiteScript Version:   
 * Description:          Daashback product order creation.Calculate the Dashback: Pickup Jobs quantity at the end of every week and create the invoice.  
 *
 * Copyright (c) 2023 MailPlus Pty. Ltd.
 */

var usage_threshold = 200; //20
var usage_threshold_invoice = 1000; //1000
var adhoc_inv_deploy = 'customdeploy2';
var prev_inv_deploy = null;
var ctx = nlapiGetContext();

function main() {

    nlapiLogExecution('AUDIT', 'prev_deployment', ctx.getSetting('SCRIPT',
        'custscript_prev_deploy_create_prod_order'));

    prev_inv_deploy = ctx.getDeploymentId();

    /**
     * Dashback - To Create Product Order (For Weekly Invoicing)
     */
    var createProdOrderSearch = nlapiLoadSearch(
        'customrecord_customer_product_stock',
        'customsearch_dashback_create_prod_order');
    var resultCreateProdOrder = createProdOrderSearch.runSearch();

    var old_customer_id = null;
    var product_order_id;
    var old_product_order_id = null;
    var count = 0;
    var digital_label = 0;
    var manualBarcodeCount = 0;

    var rasTeir1Count = 0;
    var rasTeir2Count = 0;
    var rasTeir3Count = 0;

    var manual_surcharge_to_be_applied = false;
    var fuel_surcharge_to_be_applied = false;

    /**
     * Go through each line item from the search.
     */
    resultCreateProdOrder.forEachResult(function (searchResult) {

        var usage_loopstart_cust = ctx.getRemainingUsage();
        nlapiLogExecution('AUDIT', 'usage_loopstart_cust', usage_loopstart_cust)
        if ((usage_loopstart_cust < 200)) {

            reschedule = rescheduleScript(prev_inv_deploy, adhoc_inv_deploy, null);
            nlapiLogExecution('AUDIT', 'Reschedule Return', reschedule);
            if (reschedule == false) {
                return false;
            }
        }

        var cust_prod_stock_id = searchResult.getValue("internalid");
        var connote_number = searchResult.getValue("custrecord_connote_number");
        var barcode_source = searchResult.getValue("custrecord_barcode_source");
        var sender_address_1 = searchResult.getValue("custrecord_sender_address_1");

        var product_name = searchResult.getValue(
            "custrecord_cust_stock_prod_name");
        var product_name_text = searchResult.getText(
            "custrecord_cust_stock_prod_name");
        var cust_prod_item = searchResult.getValue(
            "custrecord_cust_stock_prod_name");
        var cust_prod_date_stock_used = searchResult.getValue(
            "custrecord_cust_date_stock_used");
        var cust_prod_customer = searchResult.getValue(
            "custrecord_cust_prod_stock_customer");
        var cust_prod_zee = searchResult.getValue("partner",
            "CUSTRECORD_CUST_PROD_STOCK_CUSTOMER", null);

        var barcode = searchResult.getValue("name");

        var receiverSuburb = searchResult.getValue(
            "custrecord_receiver_suburb");
        var receiverPostcode = searchResult.getValue(
            "custrecord_receiver_postcode");
        var receiverState = searchResult.getValue(
            "custrecord_receiver_state");

        //TGE RAS - Suburb List
        var tgeRASSuburbListSearch = nlapiLoadSearch('customrecord_tge_ras_suburb_list',
            'customsearch_tge_ras_suburb_list');

        var newFilters = new Array();
        newFilters[newFilters.length] = new nlobjSearchFilter('custrecord_ras_suburb', null, 'is',
            receiverSuburb);
        newFilters[newFilters.length] = new nlobjSearchFilter('custrecord_ras_postcode', null, 'is',
            receiverPostcode);

        tgeRASSuburbListSearch.addFilter(newFilters);
        var tgeRASSuburbListSearch = tgeRASSuburbListSearch.runSearch();
        var teirType = 0;
        tgeRASSuburbListSearch.forEachResult(function (searchResult) {

            teirType = searchResult.getValue('custrecord_ras_teir');
            return true;
        });

        if (teirType == 1) {
            rasTeir1Count++;
        } else if (teirType == 2) {
            rasTeir2Count++;
        } else if (teirType == 3) {
            rasTeir3Count++;
        }



        var z1 = cust_prod_date_stock_used.split('/');
        var date = (parseInt(z1[0]) < 10 ? '0' : '') + parseInt(z1[0]);
        var month = (parseInt(z1[1]) < 10 ? '0' : '') + parseInt(z1[1]);

        var new_date = date + '/' + month + '/' + z1[2];

        var prod_name = product_name_text.split(" - ");
        var product_type = prod_name[1].substring(0, 2);

        nlapiLogExecution('DEBUG', 'product_type', product_type);
        nlapiLogExecution('DEBUG', 'Barcode', barcode);
        nlapiLogExecution('DEBUG', 'Prod Name', product_name);
        nlapiLogExecution('DEBUG', 'Prod Order ID', product_order_id);


        if (cust_prod_customer != old_customer_id) {

            /**
             * Reschedule script after creating product order for each customer
             */
            if (count != 0) {
                var productOrderRec = nlapiLoadRecord(
                    'customrecord_mp_ap_product_order', old_product_order_id);

                if (manual_surcharge_to_be_applied == true) {
                    productOrderRec.setFieldValue(
                        'custrecord_manual_surcharge_applied', 1)
                } else {
                    productOrderRec.setFieldValue(
                        'custrecord_manual_surcharge_applied', 2)
                }

                productOrderRec.setFieldValue('custrecord_ras_teir1_barcode_count', rasTeir1Count);
                productOrderRec.setFieldValue('custrecord_ras_teir2_barcode_count', rasTeir2Count);
                productOrderRec.setFieldValue('custrecord_ras_teir3_barcode_count', rasTeir3Count);
                productOrderRec.setFieldValue('custrecord_manual_barcode_count', manualBarcodesCount);
                nlapiSubmitRecord(productOrderRec);

                rasTeir1Count = 0;
                rasTeir2Count = 0;
                rasTeir3Count = 0;

                var params = {
                    custscript_prev_deploy_create_prod_order: ctx.getDeploymentId(),
                }

                reschedule = rescheduleScript(prev_inv_deploy, adhoc_inv_deploy,
                    params);
                nlapiLogExecution('AUDIT', 'Reschedule Return', reschedule);
                if (reschedule == false) {

                    return false;
                }
            }


            /**
             * Create Product Order
             */
            nlapiLogExecution('DEBUG', 'New Prod Order');

            var product_order_rec = nlapiCreateRecord(
                'customrecord_mp_ap_product_order');

            product_order_rec.setFieldValue('custrecord_fuel_surcharge_applied',
                1);

            product_order_rec.setFieldValue('custrecord_ap_order_customer',
                cust_prod_customer);
            product_order_rec.setFieldValue('custrecord_mp_ap_order_franchisee',
                cust_prod_zee);
            product_order_rec.setFieldValue('custrecord_mp_ap_order_order_status',
                4); //Order Fulfilled
            product_order_rec.setFieldValue('custrecord_mp_ap_order_date',
                getDate());
            product_order_rec.setFieldValue(
                'custrecord_ap_order_fulfillment_date', getDate());
            product_order_rec.setFieldValue('custrecord_mp_ap_order_source', 6);

            product_order_id = nlapiSubmitRecord(product_order_rec);


            /**
             * Create Line Items associated to the product order.
             */
            var ap_stock_line_item = nlapiCreateRecord(
                'customrecord_ap_stock_line_item');
            ap_stock_line_item.setFieldValue('custrecord_ap_product_order',
                product_order_id);


            var barcode_beg = barcode.slice(0, 4);

            /**
             * Creating line items for the product order based on the Barcode type and the item rate selected on the customer record.
             */
            ap_stock_line_item.setFieldValue(
                'custrecord_ap_stock_line_item', product_name);

            var inv_details = 'Used:' + new_date + '-' + barcode;
            if (inv_details.length > 33) {
                inv_details = 'Used:' + new_date + '-' + connote_number;
            }
            nlapiLogExecution('DEBUG', 'Details', inv_details);
            ap_stock_line_item.setFieldValue(
                'custrecord_ap_line_item_inv_details', inv_details);
            ap_stock_line_item.setFieldValue(
                'custrecord_ap_stock_line_actual_qty', 1);

            if (barcode_source == 1 || isNullorEmpty(barcode_source)) {
                manual_surcharge_to_be_applied = true;
                manualBarcodeCount++;
            } else {
                manual_surcharge_to_be_applied = false;
                digital_label++;
            }

            nlapiSubmitRecord(ap_stock_line_item);

            /**
             * Update Customer Product Stock record with the product order ID
             */
            var cust_prod_stock_record = nlapiLoadRecord(
                'customrecord_customer_product_stock', cust_prod_stock_id);
            cust_prod_stock_record.setFieldValue(
                'custrecord_prod_stock_prod_order', product_order_id)
            cust_prod_stock_record.setFieldValue(
                'custrecord_cust_prod_stock_status', 7)
            nlapiSubmitRecord(cust_prod_stock_record);


        } else {

            /**
             * Create Line Items associated to the product order.
             */
            var ap_stock_line_item = nlapiCreateRecord(
                'customrecord_ap_stock_line_item');
            ap_stock_line_item.setFieldValue('custrecord_ap_product_order',
                product_order_id);

            var barcode_beg = barcode.slice(0, 4);

            /**
             * Creating line items for the product order based on the Barcode type and the item rate selected on the customer record.
             */

            ap_stock_line_item.setFieldValue(
                'custrecord_ap_stock_line_item', product_name);


            /**
             * Old Line Items Creation
             * Based on the delivery method and the special customer type.
             */

            var inv_details = 'Used:' + new_date + '-' + barcode;
            if (inv_details.length > 33) {
                inv_details = 'Used:' + new_date + '-' + connote_number;
            }
            ap_stock_line_item.setFieldValue(
                'custrecord_ap_line_item_inv_details', inv_details);
            ap_stock_line_item.setFieldValue(
                'custrecord_ap_stock_line_actual_qty', 1);

            if (barcode_source == 1 || isNullorEmpty(barcode_source)) {
                manual_surcharge_to_be_applied = true;
                manualBarcodeCount++;
            } else {
                manual_surcharge_to_be_applied = false;
                digital_label++;
            }


            nlapiSubmitRecord(ap_stock_line_item);

            /**
             * Update the Customer Product Stock record with the Product Order ID
             */
            var cust_prod_stock_record = nlapiLoadRecord(
                'customrecord_customer_product_stock', cust_prod_stock_id);
            cust_prod_stock_record.setFieldValue(
                'custrecord_prod_stock_prod_order', product_order_id)
            cust_prod_stock_record.setFieldValue(
                'custrecord_cust_prod_stock_status', 7)
            nlapiSubmitRecord(cust_prod_stock_record);


            /**
             * Reschedule script after updating product order with AP Line Item an the count of line items created is 150
             */
            if (count > 450) {
                nlapiLogExecution('DEBUG', 'Count', count);

                var productOrderRec = nlapiLoadRecord(
                    'customrecord_mp_ap_product_order', old_product_order_id);
                if (manual_surcharge_to_be_applied == true) {
                    productOrderRec.setFieldValue(
                        'custrecord_manual_surcharge_applied', 1)
                } else {
                    productOrderRec.setFieldValue(
                        'custrecord_manual_surcharge_applied', 2)
                }

                productOrderRec.setFieldValue('custrecord_ras_teir1_barcode_count', rasTeir1Count);
                productOrderRec.setFieldValue('custrecord_ras_teir2_barcode_count', rasTeir2Count);
                productOrderRec.setFieldValue('custrecord_ras_teir3_barcode_count', rasTeir3Count);
                productOrderRec.setFieldValue('custrecord_manual_barcode_count', manualBarcodesCount);
                nlapiSubmitRecord(productOrderRec);

                rasTeir1Count = 0;
                rasTeir2Count = 0;
                rasTeir3Count = 0;

                var params = {
                    custscript_prev_deploy_create_prod_order: ctx.getDeploymentId(),
                }

                reschedule = rescheduleScript(prev_inv_deploy, adhoc_inv_deploy,
                    params);
                nlapiLogExecution('AUDIT', 'Reschedule Return', reschedule);
                if (reschedule == false) {

                    return false;
                }
            }
        }


        old_customer_id = cust_prod_customer;
        old_product_order_id = product_order_id
        count++;

        return true;
    });

    if (count > 0) {
        var productOrderRec = nlapiLoadRecord(
            'customrecord_mp_ap_product_order', old_product_order_id);
        if (manual_surcharge_to_be_applied == true) {
            productOrderRec.setFieldValue(
                'custrecord_manual_surcharge_applied', 1)
        } else {
            productOrderRec.setFieldValue(
                'custrecord_manual_surcharge_applied', 2)
        }

        productOrderRec.setFieldValue('custrecord_ras_teir1_barcode_count', rasTeir1Count);
        productOrderRec.setFieldValue('custrecord_ras_teir2_barcode_count', rasTeir2Count);
        productOrderRec.setFieldValue('custrecord_ras_teir3_barcode_count', rasTeir3Count);
        productOrderRec.setFieldValue('custrecord_manual_barcode_count', manualBarcodesCount);
        nlapiSubmitRecord(productOrderRec);
    }

}

/**
 * Return today's date
 * @return {[String]} today's date
 */
function getDate() {
    var date = new Date();
    if (date.getHours() > 6) {
        date = nlapiAddDays(date, 1);
    }
    date = nlapiDateToString(date);

    return date;
}