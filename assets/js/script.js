const APIKey = "3bdd91ff-4947-4b0d-9136-f31b5ea77e8d"; // Hypixel Skyblock API Key
const domainURL = "https://api.hypixel.net";
var productData = {};
var itemData = {};
//const updateTime = 100; // Milliseconds between each update, 60000 is one minute
let nameMap = new Map(); // Maps from item id to recognizable name(can't use item name since it uses illegal characters)
let data = [];


// Replacing some of the names Hypixel messed up
nameMap.set('GOBLIN_EGG_GREEN', 'Green Goblin Egg');
nameMap.set('GOBLIN_EGG_RED', 'Red Goblin Egg');
nameMap.set('GOBLIN_EGG_YELLOW', 'Yellow Goblin Egg');
nameMap.set('GOBLIN_EGG_BLUE', 'Blue Goblin Egg');
nameMap.set('RED_GIFT', 'Red Gift');


// Functions
function getData(callbackFunction, str) {
    let accessDomainURL = domainURL + str;
    $.getJSON(accessDomainURL, callbackFunction);
}

function itemCallback(result) {
    if (result.success) {
        itemData = result;
    } else {
        setTimeout(getData(itemCallback), 10000);
    }
}

let newData = false; // Boolean to check if new data has been queried
function productCallback(result) {
    if (result.success) {
        productData = result;
        newData = true;
        update();
    } else {
        setTimeout(getData(productCallback), 10000);
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


function update() {
    if (newData) {
        data = [];
    }
    for (i in productData.products) {
        if (!newData) { // No need to execute loop if no new data is queried
            break;
        }

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
        product.name = '';
        if (nameMap.has(item.id)) {
            product.name = nameMap.get(item.id);
        } else {
            product.name = item.name;
        }

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
        
        // Orders per hour is limited by buy orders, sell offers, and the maximum amount you can afford
        let ordersPerHour = Math.min(product.buyOrdersFilledPerHour, product.sellOffersFilledPerHour, budget / product.buyOrder);
        product.expectedProfitPerHour = (ordersPerHour * product.profitMargin / 100).toFixed(1);

        data.push(product);
    }
    newData = false;

    switch (sortFunction) {
        case "0":
            data.sort(function compare0(a, b) { return a.name.localeCompare(b.name); });
            break;
        case "1":
            data.sort(function compare1(a, b) { return b.profitMargin - a.profitMargin });
            break;
        case "2":
            data.sort(function compare2(a, b) { return b.expectedReturn - a.expectedReturn });
            break;
        case "3":
            data.sort(function compare3(a, b) { return b.expectedProfitPerHour - a.expectedProfitPerHour });
            break;
        default:
            console.log("stop messing with my page lol");
            break;
    }

    displayContent(searchFilter);
}


// Displays the filtered content
function displayContent(filter) {
    let content = $('<table>').addClass('info');
    content.attr('id', 'infoTable');
    let headerFields = "<th>Item Name</th><th>Buy Price</th><th>Sell Price</th><th>Profit Margin</th><th>Expected Return</th><th>Profit per Hour</th>";
    let header = $('<tr>').html(headerFields);
    content.append(header);
    for (i in data) {
        let product = data[i];
        if (product.name.toUpperCase().indexOf(filter) > -1) {
            let rowFields = "<td>" + product.name + "</td><td>" + numberWithCommas(product.buyOrder) + "</td><td>" + 
            numberWithCommas(product.sellOffer) + "</td><td>" + numberWithCommas(product.profit) + " (" + numberWithCommas(product.profitMargin) + 
            "%)</td><td>"+ numberWithCommas(product.expectedReturn) + "</td><td>" + numberWithCommas(product.expectedProfitPerHour) + "</td>";
            let row = $('<tr>').html(rowFields);
            content.append(row);
        }
    }
    $('#content').html(content);
}


/* This overloaded the Hypixel server and bugged out later API requests(at least from my API key)
// Updates the content every updateTime interval
let updateContent = setInterval(update, updateTime); 


// Resets the update timer and refreshes the table when refresh button is clicked
function refresh() {
    clearInterval(updateContent);
    update();
    updateEveryMinute = setInterval(update, updateTime);
} */


// Resets the search filter to none and updates the content
$('#refreshButton').on('click', function() {
    searchFilter = "";
    $('#searchBar').val(searchFilter);
    getData(productCallback, "/skyblock/bazaar?key" + APIKey);
}); 


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

// 0: Item Name, 1: Profit Margin, 2: Expected Return, 3: Profit per Hour
let sortFunction = "3"; // Default sort function(Profit per Hour)
$('#sortFunction').val(sortFunction);
$('#sortFunction').on('change', function() {
    sortFunction = $(this).val();
    update();
})

// Filters the list by whatever is in the search bar
let searchFilter = "";
$('#searchBar').keyup(function() {
    searchFilter = $(this).val();
    let filter = searchFilter.toUpperCase();
    displayContent(filter);
})

getData(productCallback, "/skyblock/bazaar?key" + APIKey); // Gets all the Bazaar Product Data
getData(itemCallback, "/resources/skyblock/items?key" + APIKey); // Gets all the item data