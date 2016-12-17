var express = require('express');
// var jsdomm = require('jsdom');
var app = express();
var request = require('requestify');
var $ = require("jquery");
var cheerio = require('cheerio');
var simpleCount = 0;
var mailer = require('nodemailer');
var fs = require('fs');
var semaphore = require('semaphore')(1);
var productState =  [];
var productName = [];


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
var mailOptions = {
    from: '"www.whiskyfr.com Alert" <'+process.env.EMAIL+'>', // sender address (who sends)
    to: process.env.EMAIL, // list of receivers (who receives)
    subject: 'There was a change in the availability of a product.', // Subject line
};


var newProductFlag = false;
var stateProductFlag = false;



var whiskyFr = {
	url:"http://www.whisky.fr/en/selections/new-arrivals.html"
};
module.exports = {
	setupWhiskyFr:function(){
		request.get(whiskyFr.url).then(function(response){
			var string = response.getBody();
			$ = cheerio.load(string);
			var presentProductNames = $('#products-list > li > div > div > div.product-primary > h2 > a');
			var presentProductStates = $("#products-list > li > div.product-shop > div > div:nth-child(3) > p.availability > span");

			for(var J = 0 ; J < presentProductNames.length ; J++){
				productName[J] = $(presentProductNames[J]).html().trim().replace('&#xA0;',' ');
			}
			for(var J = 0 ; J < presentProductStates.length ; J++){
				productState[J] = $(presentProductStates[J]).html().trim();
			}
			console.log("Setup completed for "+whiskyFr.url+"\nWill be sending requests every 5 minute and check for webpage content changes -- "+whiskyFr.url);
		});
	},
	getWhiskyFr:function(){

		request.get(whiskyFr.url).then(function(response){
			var string = response.getBody();
			newProductFlag = false;
			stateProductFlag = false;

			$ = cheerio.load(string);
			var presentProductNames = $('#products-list > li > div > div > div.product-primary > h2 > a');
			var presentProductStates = $("#products-list > li > div.product-shop > div > div:nth-child(3) > p.availability > span");

			var firstPresentProductName = $('#products-list > li:first-child > div > div > div.product-primary > h2 > a').html().trim().replace('&#xA0;',' ');
			var appendableProducts = '';
			var appendableStatesOfProducts = [];
			var i=0;
			

			for ( var I = 0 ; I < presentProductNames.length ; I++){
				if(productName[i] !== $(presentProductNames[I]).html().trim().replace('&#xA0;',' ')){
					if($(presentProductNames[I]).html().trim().replace('&#xA0;',' ') != productName[0]){
						appendableProducts += (I+1)+'. ' + $(presentProductNames[I]).html().trim().replace('&#xA0;',' ') + '<br>';
						if(!newProductFlag) newProductFlag= true;
					}
					else {
						break;
					}
				}
				else {
					break;
				}
			}
			i = 0;
			for(var J = 0 ; J < presentProductStates.length ; J++){
				if(newProductFlag){
					// fs.appendFile('logging2.txt',J+'. '+productName[i]+' == '+$(presentProductNames[J]).html().trim().replace("&#xA0;"," ")+' ???!\r\n');
					if(productName[i] == $(presentProductNames[J]).html().trim().replace("&#xA0;",' ')){
						if((!productState[i].includes('In stock')) && $(presentProductStates[J]).html().includes('In stock') )	{
							var obj = {
								productState:'In stock',
								productName:productName[i]
							};
							appendableStatesOfProducts.push(obj);
							if(!stateProductFlag) stateProductFlag = true;
							i++;
						}
					}
				}
				else{

					if((!productState[J].includes('In stock')) && $(presentProductStates[J]).html().includes('In stock'))	{
						var obj = {
							productState:'In stock',
							productName:productName[J]
						};
						appendableStatesOfProducts.push(obj);
						if(!stateProductFlag) stateProductFlag= true;

					}
					
				}
			}
			
			
		// If there is a new product on the page first send a mail for the list of the new products 
		if(newProductFlag){
			mailOptions.html ="<b>There is a brand new delivery on the webpage go check it !<b>  <br> " + appendableProducts;
			mailOptions.subject = "There is a brand new delivery on the webpage "+whiskyFr.url;
			transporter.sendMail(mailOptions, function(error, info){
				if(error){
					return console.log(error);
				}

				console.log('Message sent successfully: ' + info.response);
				
			});
			for(var I = 0 ; I < presentProductNames.length; I++){
				productName[I] = $(presentProductNames[I]).html().trim().replace('&#xA0;',' ');

			}

			// If there are also new product states then send a mail for the list of updated products
			if(stateProductFlag){
				mailOptions.html = "<b> There is a product availability change on the webpage.<b>  The name of the products are: <br> ";
				mailOption.subject = "There is a product availability change on the webpage "+whiskyFr.url;
				var appendableHtml='';
				for(var j = 0;j<appendableStatesOfProducts.length;j++){
					appendableHtml += (j+1)+". "+appendableStatesOfProducts[j].productName+' , availability '+appendableStatesOfProducts[j].productState+' \n'; 
				}
				mailOption.html += appendableHtml;
				transporter.sendMail(mailOptions, function(error, info){
					if(error){
						return console.log(error);
					}

					console.log('Message sent successfully: ' + info.response);
					
				});	
				for(var J = 0 ; J < presentProductStates.length ; J++){
					productState[J] = $(presentProductStates[J]).html().trim();

				}
			}

			else{
				for(var J = 0 ; J < presentProductStates.length ; J++){
					productState[J] = $(presentProductStates[J]).html().trim();
				}
			}
			return ;
			
		}
		else if(stateProductFlag){
			var appendableHtml='<b> There is a product availability change on the webpage.<b>  The name of the products are: <br> ';
			for(var j = 0;j<appendableStatesOfProducts.length;j++){
				appendableHtml += (j+1)+". "+appendableStatesOfProducts[j].productName+' , availability '+appendableStatesOfProducts[j].productState+' <br>'; 
			}

			mailOptions.html = appendableHtml;
			mailOptions.subject = "There is a product availability chagnge on the webpage "+whiskyFr.url;
			transporter.sendMail(mailOptions, function(error, info){
				if(error){
					return console.log(error);
				}

				console.log('Message sent successfully: ' + info.response);
				
			});	
			for(var J = 0 ; J < presentProductStates.length ; J++){
				productState[J] = $(presentProductStates[J]).html().trim();
			}
			return ;
		}
		else
			console.log("There was no change in the content of the webpage "+whiskyFr.url);
	});

	}
};
