const APIKey = "3bdd91ff-4947-4b0d-9136-f31b5ea77e8d"; // Hypixel Skyblock API Key
const domainURL = "https://api.hypixel.net";
var productData = {};
var itemData = {};


// Functions
function getData(callbackFunction, str) {
    let accessDomainURL = domainURL + str;
    $.getJSON(accessDomainURL, callbackFunction);
}

function itemCallback(result) {
    if (result.success) {
        itemData = result;
    } else {
        setTimeout(getData(itemCallback), 1000);
    }
}

function productCallback(result) {
    if (result.success) {
        productData = result;
        update();
    } else {
        setTimeout(getData(productCallback), 1000);
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function update() {
    var data = [];
    for (i in productData.products) {
        // buy_summary and sell_summary detailed in Hypixel's Bazaar API guide
        let buySummary = productData.products[i].buy_summary;
        let sellSummary = productData.products[i].sell_summary;
        let quickStatus = productData.products[i].quick_status;
        let item = itemData.items.find(function(o) {
            return o.id === i;
        });

        if (buySummary.length <= 0 || sellSummary.length <= 0) { // Should never trigger
            continue;
        }

        let product = {};
        product.name = item.name;
        product.buyOrder = (Math.max.apply(null, sellSummary.map(function(p) { return p.pricePerUnit; })) + 0.1).toFixed(1);
        product.sellOffer = (Math.min.apply(null, buySummary.map(function(p) { return p.pricePerUnit; })) - 0.1).toFixed(1);

        product.buyOrdersFilledPerHour = quickStatus.buyMovingWeek / 168;
        product.sellOffersFilledPerHour = quickStatus.sellMovingWeek / 168;

        if (product.sellOffer <= item.npc_sell_price) { // Handles the case where NPC pays more than bazaar
            product.sellOffer = item.npc_sell_price; // Sell to NPC instead of bazaar
            product.name = product.name + "*"; // Indicates to user to sell to NPC instead of bazaar
            product.sellOffersFilledPerHour = Infinity;
        }

        product.profit = (((1 - (taxRate / 100)) * product.sellOffer) - product.buyOrder).toFixed(1);
        product.profitMargin = (100 * product.profit / product.buyOrder).toFixed(2);
        product.expectedReturn = (product.profitMargin * budget / 100).toFixed(0);
        
        let ordersPerHour = Math.min(product.buyOrdersFilledPerHour, product.sellOffersFilledPerHour);
        product.expectedProfitPerHour = (ordersPerHour * product.profitMargin / 100).toFixed(1);

        data.push(product);
    }

    data.sort(function compare(a, b) { return b.expectedProfitPerHour - a.expectedProfitPerHour });

    let content = $('<table>').addClass('results');
    let headerFields = "<th> Item Name</th><th>Buy Price</th><th>Sell Price</th><th>Profit Margin</th><th>Expected Return</th><th>Expected Profit per Hour</th>";
    let header = $('<tr>').html(headerFields);
    content.append(header);
    for (i in data) {
        let product = data[i];
        let rowFields = "<td>" + product.name + "</td><td>" + numberWithCommas(product.buyOrder) + "</td><td>" + 
            numberWithCommas(product.sellOffer) + "</td><td>" + numberWithCommas(product.profit) + " (" + numberWithCommas(product.profitMargin) + 
            "%)</td><td>"+ numberWithCommas(product.expectedReturn) + "</td><td>" + numberWithCommas(product.expectedProfitPerHour) + "</td>";
        let row = $('<tr>').html(rowFields);
        content.append(row);
    }
    $('#content').html(content);

}


// Refreshes the table when refresh button is clicked
$('#refreshButton').on('click', update);


// Run on startup
let taxRate = 1.25; // Default bazaar tax rate
$('#taxRate').val(taxRate);
$('#taxRate').on('change', function() {
    taxRate = $(this).val();
    update();
});

let budget = 1000000; // Default budget
$('#budget').val(budget);
$('#budget').keyup(function() {
    budget = $(this).val();
    update();
});

getData(productCallback, "/skyblock/bazaar?key" + APIKey); // Gets all the product data
getData(itemCallback, "/resources/skyblock/items?key" + APIKey); // Gets all the item data