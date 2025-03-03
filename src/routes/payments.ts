import { t, Elysia } from 'elysia';
import crypto from 'crypto';
import dotenv from 'dotenv';
import SSLCommerzPayment from 'sslcommerz-lts';
import { v4 as uuidv4 } from 'uuid';
import SSLCommerz from 'sslcommerz-nodejs';
import sql from '../db/database';
import jwt from "@elysiajs/jwt";
import { readFileSync } from 'fs';
import { sendEmailToAdmin } from '../utils/email';
import { convertDateFormat } from '../utils/misc';
dotenv.config();

const store_id = process.env.SSL_STORE_ID ;
const store_password = process.env.SSL_STORE_PASS ;
const is_live = false; // Set to true for production
const sslcommerz_base_url = is_live ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';

export const payment = new Elysia()
  .use(jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!
    })) 
  .post('/save-unpaid', async ({ jwt, headers, body} ) => {
    console.log("Save unpaid payment data request initiated.");
    console.log('Save payment data:', body);
    //TODO: NOTIFY THE ADMIN THROUGH EMAIL AND WHATSAPP

    let userId: string;
    const {caregiver_id, service_time, address, amount, isMonthly} = body;
    const authHeader = headers.authorization;
        console.log(headers);  
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
          });
        }
        const token = authHeader.split(' ')[1];
        try {
          const decoded = await jwt.verify(token) as {
            userId: string;
          };
          userId = decoded.userId;
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid token' }), {status: 401});
        }
    console.log('User ID (Save Payment info):', userId);
    try{
    let query, q1;

    // create a dummy payments field
    try{
      q1 = await sql`
      INSERT INTO public.payments (
        user_id, amount, currency, status, details, created_at, updated_at
      ) VALUES (
        ${userId}, ${amount}, 'BDT', false, 'caregiver service', now(), now()
      ) 
      RETURNING payment_id
   `;
  
    }catch(e){
console.log("Error in inserting into payments (save-unpaid): ", e)
    }

    sendEmailToAdmin('New Service Request (Pay later)', `A new service request has been initiated by user ${userId}.\n The request:\n${JSON.stringify(body)}`);

      console.log("res (Save payment info in db): ", JSON.stringify(query));
      return new Response(JSON.stringify({ message: 'Payment data saved successfully', RESULT: JSON.stringify(query) }), {
        status:200
      });
    }catch(e){
      console.log("ERROR from payment data save: ", e);
      return new Response(JSON.stringify({ message: 'Payment datasave FAILED'}), {
        status: 500
      });
    }

  },{
    body: t.Object({
      user_id: t.String(),
      caregiver_id: t.String(),
      amount: t.Number(),
      address: t.String(),
      service_time: t.String(),
      isMonthly: t.Boolean()
    })
  })

  // SSLCommerz Payment Initialization
  .post('/init', async ({ jwt, headers, body} ) => {
    console.log('Payment initialization endpoint hit.');
    console.log('Request body:', body);
    let userId: string;

    const authHeader = headers.authorization;
        console.log(headers);  
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
          });
        }
        const token = authHeader.split(' ')[1];
        try {
          const decoded = await jwt.verify(token) as {
            userId: string;
          };
          userId = decoded.userId;
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid token' }), {status: 401});
        }
    console.log('User ID (Payment):', userId);
    let trx;
    let serviceTimeStart='', serviceTimeEnd='';

    try{
      const careres = await sql`
      UPDATE caregivers
      SET status = 'busy'
      WHERE id = ${body.caregiver_id}
      `
    }catch(e){
      console.log("Error while setting caregiver status to busy: ", e);
    }
    
    if(body.isMonthly){ 
      serviceTimeStart= body.service_time; 
      // Parse the date string assuming dd/mm/yyyy format
      const [day, month, year] = serviceTimeStart.split("/").map(Number);
      const startDate = new Date(year, month - 1, day); // Month is 0-indexed

      // Calculate the end date by adding one month
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      // Format the end date back to dd/mm/yyyy
      serviceTimeEnd = `${endDate.getDate().toString().padStart(2, '0')}/${(endDate.getMonth() + 1).toString().padStart(2, '0')}/${endDate.getFullYear()}`;
      
      serviceTimeStart = convertDateFormat(serviceTimeStart);
      serviceTimeEnd = convertDateFormat(serviceTimeEnd);
    }else{
      [serviceTimeStart, serviceTimeEnd] = body.service_time.split(' - ');
    
      serviceTimeStart = convertDateFormat(serviceTimeStart);
      serviceTimeEnd = convertDateFormat(serviceTimeEnd);
    }
    console.log(`Service time: ${body.service_time}\nService start time: ${serviceTimeStart} & end time: ${serviceTimeEnd}`)
    try {
      trx = await sql`
      INSERT INTO public.payments(user_id, amount, currency, status, details, created_at, updated_at)
      VALUES(${userId}, ${body.total_amount}, 'BDT', false, 'caregiver service', now(), now())
      RETURNING *
    `;
    console.log("Inserted into payments with trx id : ", trx)
    } catch (e) {
      console.error("Error inserting into payments:", e);
      console.log("The req body:", body)
    }

    try{
      const q = await sql`
      INSERT INTO public.address (user_id, street, town, district, zip, country)
      VALUES(${userId}, ${body.cus_city}, ${body.service_category['street']}, ${body.service_place['town']}, ${body.service_place['district']}, ${body.service_place['zip']}, ${body.service_place['country']??'Bangladesh'})
      `
      const q2 = await sql`
          UPDATE public.rm_users
        SET address = (
          SELECT jsonb_build_object(
            'street', street,
            'town', town,
            'district', district,
            'zip', zip,
            'country', country
          )
          FROM public.address
          WHERE user_id = ${userId}
          ORDER BY id DESC
          LIMIT 1
        )
        WHERE user_id = ${userId} AND address IS NULL;
      `;
      
    }catch{
      console.log("Error while inserting into address table and/or updating address in user table.")
    }
    
    
    console.log("TRX:",trx)
    const data = {
      total_amount: body.total_amount, // Amount to be paid
      currency: 'BDT',
      tran_id: trx![0].transaction_id, // Unique transaction ID
      success_url: `${body.base_url}/payment/success`,
      fail_url: `${body.base_url}/payment/fail`,
      cancel_url: `${body.base_url}/payment/cancel`,
      ipn_url: `${body.base_url}/payment/ipn`,
      shipping_method: JSON.stringify(body.service_place) || 'Courier',
      product_name: body.service_type,
      product_category: body.service_category || 'General',
      product_profile: body.service_info || 'general',
      cus_name: body.cus_name,
      cus_email: body.cus_email || '',
      cus_add1: body.cus_add1 || '',
      cus_add2: body.cus_add2 || '',
      cus_city: body.cus_city || '',
      cus_state: body.cus_state || '',
      cus_postcode: body.cus_postcode || '',
      cus_country: body.cus_country || 'Bangladesh',
      cus_phone: body.cus_phone || '',
      cus_fax: body.cus_fax || '',
      ship_name: body.service_provider || body.cus_name,
      ship_add1: body.cus_add1|| 'Bangladesh',
      ship_add2: body.cus_add2|| '',
      ship_city: body.cus_city|| 'Dhaka',
      ship_state: body.cus_state || 'Dhaka',
      ship_postcode: body.cus_postcode || '1216',
      ship_country: body.cus_country || 'Bangladesh',
    };

    sendEmailToAdmin('New Payment Request', `A new payment request has been initiated by user ${userId}.\n The payment request:\n${data}`);
    
    try{
      let settings = {
          isSandboxMode: !is_live, //false if live version
          store_id: store_id,
          store_passwd: store_password
      }
      let sslcommerz = new SSLCommerz(settings);
      var res = await sslcommerz.init_transaction(data);
      console.log("Response: ", res);
      
      return new Response(JSON.stringify({url:res.GatewayPageURL, res}), {
        status: 200
      })

    }catch(e){
        console.log(e);
        return new Response(JSON.stringify({ error: 'An error occurred while processing the payment.' }), {
          status: 400
        })
    }
  },{
      body: t.Object({
        total_amount: t.Number(),
        base_url: t.String(),
        service_place: t.String(),
        service_type: t.String(),
        service_category: t.String(),
        service_time : t.String(),
        isMonthly: t.Boolean(),
        caregiver_id : t.String(),
        service_info: t.String(),
        service_provider: t.String(),
        cus_name: t.String(),
        cus_email: t.String(),
        cus_add1: t.String(),
        cus_add2: t.String(),
        cus_city: t.String(),
        cus_state: t.String(),
        cus_postcode: t.String(),
        cus_country: t.String(),
        cus_phone: t.String(),
        cus_fax: t.String(),
      })

  })

  // Payment Success
.post('/success', async ({ body }: {body: any}) => {
  console.log('Payment success body:', body);

  const data = {
      transaction_id: body.tran_id,
      amount: body.amount,
      currency: body.currency,
      status: body.status,
      card_type: body.card_type,
      card_no: body.card_no,
      card_issuer: body.card_issuer,
      card_brand: body.card_brand,
      card_issuer_country: body.card_issuer_country,
      card_issuer_country_code: body.card_issuer_country_code,
      currency_type: body.currency_type,
      currency_amount: body.currency_amount,
      currency_rate: body.currency_rate,
      base_fair: body.base_fair,
      value_a: body.value_a,
      value_b: body.value_b,
      value_c: body.value_c,
      value_d: body.value_d,
  };
//TODO: SAVE THIS DATA TO DATABASE!!
//TODO: FIx the below to make them work
  
let q1,q2,q3;
  try{
    q1 = await sql`
    UPDATE public.payments
    SET status = true
    WHERE transaction_id = ${data.transaction_id}
    RETURNING *
    `;
    console.log("User bought service: ", q1);

    sendEmailToAdmin(`Payment success from user ${q1[0].user_id}`, `A new payment has been made by user with transaction id: ${data.transaction_id}.\n The payment status:\n${JSON.stringify(q1[0])}`);
  
  }catch(e){
    console.log("Error from payment success (selecting user bought courses): ", e);
  }
  try{
    q2 = await sql`
    UPDATE caregivers
    SET status = 'busy'
    WHERE id = ${q1[0].caregiver_id}
    `
}catch(e){
  console.log("Error from payment success (Inserting payments)")
}

  try {
      // Dynamically create an HTML response with inline CSS
      const html = `
          <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Success</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f9f9f9;
      color: #333;
    }

    .container {
      max-width: 800px;
      margin: 50px auto;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .header {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
    }

    .content {
      padding: 20px;
    }

    .invoice {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 20px;
      margin-top: 20px;
      background: #fafafa;
    }

    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .invoice-header h2 {
      margin: 0;
      color: #4CAF50;
    }

    .invoice-header span {
      font-size: 0.9em;
      color: #666;
    }

    .invoice-details {
      margin: 20px 0;
      line-height: 1.6;
    }

    .button {
      display: inline-block;
      padding: 10px 20px;
      margin-top: 20px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      text-align: center;
      cursor: pointer;
    }

    .button:hover {
      background-color: #45a049;
    }
  </style>
</head>
<body>
  <div class="container" id="invoice-container">
    <div class="header">
      <h1>Payment Successful!</h1>
    </div>
    <div class="content">
      <p>Thank you for your payment. Below is your invoice:</p>
      <div class="invoice">
        <div class="invoice-header">
          <h2>Invoice</h2>
           <span id="transaction-date-span">Date: 2023-10-27</span> 
        </div>
        <div class="invoice-details">
          <p><strong>Transaction ID:</strong> <span id="transaction-id-span"> ${data.transaction_id} </span></p>
          <p><strong>Amount Paid:</strong> <span id="amount-paid-span"> ${data.amount} ${data.currency}</span></p>
          <p><strong>Payment Status:</strong> <span id="status-span">${data.status}</span></p>
          <p><strong>Payment Method:</strong> <span id="card-brand-span"> ${data.card_brand} (${data.card_type}) </span> </p>
          <p><strong>Card Issuer:</strong> <span id="card-issuer-span"> ${data.card_issuer} (${data.card_issuer_country}) </p>
        </div>
        <a href='https://shalish.xyz/auth/dashboard'><button>See Dashboard</button></a>
      </div>
    </div>
</body>
</html>
      `;

      return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
      });
  } catch (error) {
      console.error('Error generating HTML response:', error);
      return new Response('An error occurred.', { status: 500 });
  }
})
  .post('/validate', async ({ body } : {body:any}) => {
    const { val_id } = body;

    try {
      const url = `${sslcommerz_base_url}/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_password}&format=json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SSLCommerz validation request failed with status ${response.status}`);
      }

      const validationData = await response.json();

      console.log('SSLCommerz Validation Data:', validationData);

      if (validationData.status === 'VALID') {
        // Payment is valid. Update database or take necessary actions.
        return { message: 'Payment validated successfully', data: JSON.stringify(validationData) };
      } else if(validationData.status === "VALIDATED"){
        return { message: 'Payment already validated', data: validationData };
      }
       else {
        // Payment validation failed. Take necessary actions.
        console.error('Payment validation failed:', validationData);
        return { message: 'Payment validation failed', data: validationData, error: true };
      }
    } catch (error) {
      console.error('Error during SSLCommerz validation:', error);
      return { message: 'An error occurred during payment validation', error: true };
    }
  })

  // Payment Failure
  .post('/fail', async ({ body }) => {
    console.log('Payment failed:', body);
    return { message: 'Payment failed.', data: body };
  })

  // Payment Cancellation
  .post('/cancel', async ({ body }) => {
    console.log('Payment canceled:', body);
    return { message: 'Payment canceled.', data: body };
  })

  // SSLCommerz Payment Initialization
//   .post('/pay-later', async ({ jwt, headers, body} ) => {
//     console.log('Payment initialization endpoint hit.');
//     console.log('Request body:', body);
//     let userId: string;

//     const authHeader = headers.authorization;
//         console.log(headers);  
//         if (!authHeader || !authHeader.startsWith('Bearer ')) {
//           return new Response(JSON.stringify({ error: 'Unauthorized' }), {
//             status: 401,
//           });
//         }
//         const token = authHeader.split(' ')[1];
//         try {
//           const decoded = await jwt.verify(token) as {
//             userId: string;}
          
//           } catch {
//           return new Response(JSON.stringify({ error: 'Invalid token' }), {status: 401});
//           }


          
          .post('/validate', async ({ body } : {body:any}) => {
    const { val_id } = body;

    try {
      const url = `${sslcommerz_base_url}/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_password}&format=json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SSLCommerz validation request failed with status ${response.status}`);
      }

      const validationData = await response.json();

      console.log('SSLCommerz Validation Data:', validationData);

      if (validationData.status === 'VALID') {
        // Payment is valid. Update database or take necessary actions.
        return { message: 'Payment validated successfully', data: JSON.stringify(validationData) };
      } else if(validationData.status === "VALIDATED"){
        return { message: 'Payment already validated', data: validationData };
      }
       else {
        // Payment validation failed. Take necessary actions.
        console.error('Payment validation failed:', validationData);
        return { message: 'Payment validation failed', data: validationData, error: true };
      }
    } catch (error) {
      console.error('Error during SSLCommerz validation:', error);
      return { message: 'An error occurred during payment validation', error: true };
    }
  })
