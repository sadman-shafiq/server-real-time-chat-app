import sql from "../db/database";

async function insertPayment(paymentData) {
    const query = `
        INSERT INTO payments (
            user_id, transaction_id, amount, currency, status, success_url, fail_url, cancel_url, ipn_url,
            product_name, product_category, product_profile, shipping_method,
            customer_name, customer_email, customer_address, customer_city, customer_postcode,
            customer_country, customer_phone
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20
        ) RETURNING id;
    `;

    const values = [
        paymentData.user_id, // User ID from your application
        paymentData.transaction_id, // Unique transaction ID
        paymentData.total_amount, // Payment amount
        paymentData.currency || 'BDT', // Default to BDT if not provided
        paymentData.status, // Payment status
        paymentData.success_url, // Redirect URL on payment success
        paymentData.fail_url, // Redirect URL on payment failure
        paymentData.cancel_url, // Redirect URL on payment cancellation
        paymentData.ipn_url, // IPN URL

        paymentData.product_name, // Name of the product
        paymentData.product_category, // Product category
        paymentData.product_profile, // Product profile
        paymentData.shipping_method, // Shipping method

        paymentData.cus_name, // Customer's name
        paymentData.cus_email, // Customer's email
        paymentData.cus_add1, // Customer's address
        paymentData.cus_city, // Customer's city
        paymentData.cus_postcode, // Customer's postal code
        paymentData.cus_country, // Customer's country
        paymentData.cus_phone, // Customer's phone number
    ];

    try {
        const result = await sql.unsafe(query, values);
        console.log('Payment inserted with ID:', result);
        return result;
    } catch (error) {
        console.error('Error inserting payment:', error);
        throw error;
    }
}