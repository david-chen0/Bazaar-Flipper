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
        getData(productCallback, "/skyblock/bazaar?key" + APIKey); // Gets all the Bazaar Product Data, needs to run after item data is obtained
    } else {
        setTimeout(getData(itemCallback), 1000);
    }
}

let newData = false; // Boolean to check if new data has been queried
function productCallback(result) {
   if (result.success) {
        productData = result;
        newData = true;
        update();
    } else {
        setTimeout(getData(productCallback), 1000);
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


function update() {
    if (newData) {
        data = [];
        for (i in productData.products) {
            // buy_summary and sell_summary detailed in Hypixel's Bazaar API guide
            let buySummary = productData.products[i].buy_summary;
            let sellSummary = productData.products[i].sell_summary;
            let quickStatus = productData.products[i].quick_status;
            let item = itemData.items.find(function(o) {
                return o.id === i;
            });

            if (buySummary.length <= 0 || sellSummary.length <= 0) { // Shouldn't ever trigger but just in case
                continue;
            }

            let product = {};
            product.name = '';
            if (nameMap.has(item.id)) {
                product.name = nameMap.get(item.id);
            } else {
                product.name = item.name;
            }

            // Can't use quick status because it can be skewed by dupers/cheaters
            product.buyOrder = (Math.max.apply(null, sellSummary.map(function(p) { return p.pricePerUnit; })) + 0.1).toFixed(1);
            product.sellOffer = (Math.min.apply(null, buySummary.map(function(p) { return p.pricePerUnit; })) - 0.1).toFixed(1);

            product.buyOrdersFilledPerHour = quickStatus.buyMovingWeek / 168;
            product.sellOffersFilledPerHour = quickStatus.sellMovingWeek / 168;

            if (product.sellOffer <= item.npc_sell_price) { // Handles the case where NPC pays equal or more than bazaar
                product.sellOffer = item.npc_sell_price; // Sell to NPC instead of bazaar
                product.name = product.name + "*"; // Indicates to user to sell to NPC instead of bazaar
                product.sellOffersFilledPerHour = Infinity;
            }

            product.profit = ((1 - (taxRate / 100)) * (product.sellOffer - product.buyOrder)).toFixed(1);
            product.profitMargin = (100 * product.profit / product.buyOrder).toFixed(2);
            product.expectedReturn = (product.profitMargin * budget / 100).toFixed(0);
            
            // Orders per hour is limited by buy orders, sell offers, and the maximum amount you can afford
            let ordersPerHour = Math.min(product.buyOrdersFilledPerHour, product.sellOffersFilledPerHour, budget / product.buyOrder);
            product.expectedProfitPerHour = (ordersPerHour * product.profitMargin / 100).toFixed(1);

            data.push(product);
        }
        newData = false;

        // Updates the LAST UPDATED section to current time
        let d = new Date();
        let timeStr = "";
        if (d.getHours() < 10) {
            timeStr += "0"
        }
        timeStr += d.getHours() + ":";
        timeStr += d.getMinutes();
        document.getElementById("updateTime").innerHTML = timeStr;
    }

    switch (sortFunction) {
        case 0:
            data.sort(function compare0(a, b) { return a.name.localeCompare(b.name); });
            break;
        case 1:
            data.sort(function compare1(a, b) { return b.buyOrder - a.buyOrder });
            break;
        case 2:
            data.sort(function compare3(a, b) { return b.sellOffer - a.sellOffer });
            break;
        case 3:
            data.sort(function compare3(a, b) { return b.profitMargin - a.profitMargin });
            break;
        case 4:
            data.sort(function compare3(a, b) { return b.expectedReturn - a.expectedReturn });
            break;
        case 5:
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
    let content = document.getElementById("info");
    let rowNum = content.rows.length - 1;
    for (; rowNum > 0; rowNum--) {
        content.deleteRow(rowNum);
    }
    rowNum = 1
    for (i in data) {
        let product = data[i];
        if (product.name.toUpperCase().indexOf(filter) > -1) {
            let row = content.insertRow(rowNum);
            rowNum++;

            let prodName = row.insertCell(0);
            let prodBuyOrder = row.insertCell(1);
            let prodSellOffer = row.insertCell(2);
            let prodProfitMargin = row.insertCell(3);
            let prodExpectedReturn = row.insertCell(4);
            let prodExpectedProfitpHour = row.insertCell(5);

            prodName.innerHTML = product.name;
            prodBuyOrder.innerHTML = numberWithCommas(product.buyOrder);
            prodSellOffer.innerHTML = numberWithCommas(product.sellOffer);
            prodProfitMargin.innerHTML = numberWithCommas(product.profitMargin) + "%";
            prodExpectedReturn.innerHTML = numberWithCommas(product.expectedReturn);
            prodExpectedProfitpHour.innerHTML = numberWithCommas(product.expectedProfitPerHour);
        }
    }
    changeColumn(sortFunction, false);
}


// Removes column num's sortWithThis CSS class if bool is true, otherwise removes column num's sortWithThis CSS class
function changeColumn(num, bool) {
    let table = document.getElementById("info");
    let tableRows = table.rows;
    let rows = tableRows.length;

    for (let i = 0; i < rows; i++) {
        tr = tableRows[i];
        if (bool) {
            tr.cells[num].classList.remove("sortWithThis");
        } else {
            tr.cells[num].classList.add("sortWithThis");
        }
    }
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
    newData = true;
    update();
});

let budget = 1000000; // Default budget
$('#budget').val(budget);
$('#budget').keyup(function() {
    budget = $(this).val();
    newData = true;
    update();
});

// Determines which field is used for sorting
let idList = ["itemName", "buyPrice", "sellPrice", "profitMargin", "expectedReturn", "profitpHour"];
let sortFunction = 5;
for (let num = 0; num < 6; num++) {
    document.getElementById(idList[num]).onclick = function() {
        if (num != sortFunction) {
            changeColumn(sortFunction, true);
            sortFunction = num;
            update();
        }
    }
}

// Filters the list by whatever is in the search bar
let searchFilter = "";
$('#searchBar').keyup(function() {
    searchFilter = $(this).val();
    let filter = searchFilter.toUpperCase();
    displayContent(filter);
})

getData(itemCallback, "/resources/skyblock/items?key" + APIKey); // Gets all the item data, also calls getProductData after success