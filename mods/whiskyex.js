var express = require('express');
var app = express();
var request = require('request');
// var requestify = require('requestify');
var cheerio = require('cheerio');
var $; 
var mailer = require('nodemailer');
var fs = require('fs');
var diff = require('deep-diff').diff;
var semaphore = require('semaphore')(1);
var whiskySetup = false;
var maltSetup = false;
var MAXLIMIT = 50;
var testFlag = true;

// Test environment mailer
// -- change to the robmass account when you are finished
var mailOptions = {
    from: '"www.thewhiskyexchange.com Alert !" <'+process.env.EMAIL+'>', // sender address (who sends)
    to: process.env.EMAIL, // list of receivers (who receives)
    subject: 'There was a change in the availability of a product.', // Subject line
};


var transporter = mailer.createTransport({
	host: 'smtp.gmail.com',
	port: 465,
    secure: true, // use SSL
    auth: {
    	user: process.env.EMAIL,
    	pass: process.env.PW
    },
    tls: {
        rejectUnauthorized: false
    }
});



//TheWhiskyExchange website  config 
var theWhiskyExchange = {
	url:'https://www.thewhiskyexchange.com/new-products'
};


//Content arrays
var whiskyExchangeContent = [];



module.exports = {
	getTheWhiskyExchange:function(){
	request(theWhiskyExchange,function(error,response,body){
		if(!error && response.statusCode == 200){
			$ = cheerio.load(body);
			var testFlag = true;
			var newContent = [];
			var maxCounter = 0;
			$(".np-postlist__item").each(function(I){
				var obj = {};
			//Filling the metadata of the objects
			$(this).find('.np-posthead').children('div').each(function(i){
				var attributes = $(this).children();
				if(attributes.length >= 1) {
					attributes.each(function(I){
						if($(this).hasClass('np-posthead__date')){
							obj['deliveryMonth'] = $(this).children('.np-posthead__date-month').html().trim();
							obj['deliveryDay'] = $(this).children('.np-posthead__date-day').html().trim();
						}else if($(this).hasClass('np-posthead__title')){
							obj['deliveryTitle'] = $(this).html().trim();
						}else if($(this).hasClass('np-posthead__count')){
							obj['deliveryCount'] = $(this).html().trim();
						}else if($(this).hasClass('np-posthead__copy')){
							obj['deliveryDescription'] = $(this).children().html().trim();
						}
					});
				}
			});
			obj['deliveryProducts']=[];

			//Filling the object with the new delivered products
			$(this).find('.products-list').children().each(function(I){
				var product = {};

				$(this).children().find('.product-content').children().each(function(k){
					if($(this).hasClass('information')){
						product['name'] = $(this).children('.name').html();
						product['meta'] = $(this).children('.meta').html();
						product['spec'] = $(this).children('.spec').html();
					}else if($(this).hasClass('action')){
						$(this).children('div').each(function(n){
							if($(this).hasClass('price-container')){
								var priceContent = $(this).children();
								product['price'] = priceContent.children('.price').html().trim();
							}else if($(this).hasClass('note-container')){
								var ul = $(this).children('ul.note-list');
								product['inStock'] = false;
								var count = 0;
								ul.children('li').each(function(p){
									if($(this).text().trim().includes("In Stock"))
										product['inStock'] = true;
									else product['note'+(count++)] = $(this).text().trim();
								});
							}
						});
					}
				});

				obj['deliveryProducts'].push(product);
			});

			obj['more'] = false;
			//Filling the loadmore message
			$(this).find('.np-loadmore').each(function(I){
				obj['more'] = true;
			});
			//Testing the deep-diff module for big simplifying of the json object comparison
			var anotherObj = obj;
			if(I > MAXLIMIT){
				return false;
			}
			if(!whiskySetup)
			{
				whiskyExchangeContent.push(obj);
			}else{
				newContent.push(obj);
			}

		});

			if(!whiskySetup){
				whiskySetup = true;
				console.log("Setup completed for "+theWhiskyExchange.url+"\nWill be sending requests every 5 minute and check for webpage content changes -- "+theWhiskyExchange.url);
			}else{
				// console.log(whiskyExchangeContent[6]['deliveryProducts'][0]['inStock']);
				var differences;
				var first = null;
				if(parseInt(newContent[0]['deliveryDay']) != parseInt(whiskyExchangeContent[0]['deliveryDay'])){
					first = newContent[0];
					console.log(newContent.length);
					newContent.shift();
					console.log(newContent.length);

				}
				differences = diff(whiskyExchangeContent,newContent);
				
				var availabilityChange = [];
				var productsChange = [];
				
				var availabilityChangeFlag = false;
				var productChangeFlag = false;

				var availabilityMailText;
				var productChangeMailText;

				if(differences != undefined){

					// Check for availability changes [InStock to OutOfProducts]
					availabilityChange = "<b>There was an availability change in the products : </b><br>";

					for(var i = 0 ; i < differences.length ; i++){
						if(differences[i].kind == "E"){
							if(differences[i].lhs == false && differences[i].rhs == true && differences[i].path[3]=="inStock"){
								console.log(differences[i]);
								var path_0 = differences[i].path[0];
								var path_1 = differences[i].path[1];
								var path_2 = differences[i].path[2];
								var path_3 = differences[i].path[3];
								availabilityChange += "---- " + whiskyExchangeContent[path_0][path_1][path_2]['name'] + " , this product is now available on the page <br>";
								if(!availabilityChangeFlag)
									availabilityChangeFlag = true;
							}
						}
					}

					//Send a mail if there were changes
					if(availabilityChangeFlag){
						mailOptions.subject = "There was a product availability change on "+theWhiskyExchange.url;
						mailOptions.html = availabilityChange ;
						transporter.sendMail(mailOptions, function(error, info){
							if(error){
								return console.log(error);
							}

							console.log('Message sent successfully: ' + info.response);

						});
					}

				}

			//Check for new products !
			if(first != null){
				newContent.unshift(first);
			}
			if(parseInt(newContent[0]['deliveryDay']) != parseInt(whiskyExchangeContent[0]['deliveryDay'])){
				productChangeMailText = '<b>There are '+newContent[0]['deliveryCount'].toLowerCase()+' products available on the page :</b> <br> ';
				for(var i = 0 ; i < newContent[0]['deliveryProducts'].length; i++){
					productChangeMailText += "---- " + newContent[0]['deliveryProducts'][i]['name'] + "<br>";
				}
				if(newContent[0]['more']){
					productChangeMailText += ""+(parseInt(newContent[0]['deliveryCount'].toString().toLowerCase().split(" ")[0])-4) + " more products..<br>";
				}
				//Send a mail if there were changes
				mailOptions.subject = "There are new products on "+theWhiskyExchange.url;
				mailOptions.html = productChangeMailText ;
				transporter.sendMail(mailOptions, function(error, info){
					if(error){
						return console.log(error);
					}

					console.log('Message sent successfully: ' + info.response);

				});
				productChangeFlag = true;
			}
			if(!availabilityChangeFlag && !productChangeFlag){
				console.log("There was no change in the content of the webpage "+theWhiskyExchange.url);
			}else{
				//finish the magic work like a sir 
				whiskyExchangeContent = newContent;
			}
		}	
	}	
});
}
};








