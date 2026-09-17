/* SecondFactor.ai — demo rate data. Replace RATES values with your real price list. */
(function(){
// SecondFactor.ai website content + demo rate data (mockup values).
const RATES = {
  "United States":{dial:"+1",sms:0.0071,whatsapp:0.0042,viber:null,rcs:0.0055},
  "United Kingdom":{dial:"+44",sms:0.0310,whatsapp:0.0338,viber:0.0210,rcs:0.0190},
  "Germany":{dial:"+49",sms:0.0725,whatsapp:0.0455,viber:0.0290,rcs:0.0260},
  "France":{dial:"+33",sms:0.0480,whatsapp:0.0410,viber:0.0265,rcs:0.0235},
  "Spain":{dial:"+34",sms:0.0395,whatsapp:0.0362,viber:0.0240,rcs:0.0205},
  "India":{dial:"+91",sms:0.0038,whatsapp:0.0014,viber:null,rcs:0.0009},
  "Indonesia":{dial:"+62",sms:0.0285,whatsapp:0.0163,viber:0.0120,rcs:null},
  "Philippines":{dial:"+63",sms:0.0320,whatsapp:0.0188,viber:0.0145,rcs:null},
  "Vietnam":{dial:"+84",sms:0.0410,whatsapp:0.0195,viber:0.0135,rcs:null},
  "Nepal":{dial:"+977",sms:0.0345,whatsapp:0.0142,viber:0.0098,rcs:null},
  "Bangladesh":{dial:"+880",sms:0.0290,whatsapp:0.0150,viber:0.0115,rcs:null},
  "Pakistan":{dial:"+92",sms:0.0255,whatsapp:0.0168,viber:null,rcs:null},
  "Brazil":{dial:"+55",sms:0.0225,whatsapp:0.0118,viber:null,rcs:0.0135},
  "Mexico":{dial:"+52",sms:0.0345,whatsapp:0.0125,viber:null,rcs:0.0150},
  "Nigeria":{dial:"+234",sms:0.0295,whatsapp:0.0205,viber:null,rcs:null},
  "United Arab Emirates":{dial:"+971",sms:0.0450,whatsapp:0.0295,viber:null,rcs:0.0275},
  "Saudi Arabia":{dial:"+966",sms:0.0425,whatsapp:0.0280,viber:null,rcs:0.0265},
  "Turkey":{dial:"+90",sms:0.0190,whatsapp:0.0155,viber:0.0130,rcs:null},
  "Australia":{dial:"+61",sms:0.0385,whatsapp:0.0345,viber:null,rcs:0.0290},
  "Japan":{dial:"+81",sms:0.0620,whatsapp:0.0510,viber:0.0395,rcs:0.0360}
};

const CHANNEL_META = [
  {key:"sms",label:"SMS"},
  {key:"whatsapp",label:"WhatsApp"},
  {key:"viber",label:"Viber"},
  {key:"rcs",label:"RCS"}
];

const PRICING_INTRO = {
  sms:{title:"SMS OTP pricing",blurb:"Reach any mobile number without requiring a messaging app. Rates vary by destination, and message length and encoding can affect billable segments."},
  whatsapp:{title:"WhatsApp OTP pricing",blurb:"Authentication-template messages through your connected WhatsApp Business Account — often the lower-cost route in messaging-first markets."},
  viber:{title:"Viber OTP pricing",blurb:"Delivery through an approved Viber business sender in supported markets. Availability depends on the destination and sender approval."},
  rcs:{title:"RCS OTP pricing",blurb:"Branded delivery to recipients whose device and carrier support RCS. Eligibility is checked per recipient before RCS is attempted."}
};

const HOME_FAQS = [
  {q:"How Does SecondFactor Choose a Delivery Channel?",a:"Our Price Intelligence Engine checks the destination and eligible channels, then attempts delivery through the lowest-cost option. If delivery isn't confirmed within eight seconds, it tries the next eligible channel."},
  {q:"Do I Need to Connect Every Channel?",a:"You can start with the channels you need and add others later. SecondFactor routes requests through channels enabled for your account and available to the recipient."},
  {q:"Do I Need a WhatsApp Business Account to Send WhatsApp OTPs?",a:"Yes, you need to connect a WhatsApp Business Account and complete the applicable setup and authentication template approvals before sending WhatsApp OTPs."},
  {q:"Do I Need to Generate and Store OTPs in My Application?",a:"SecondFactor handles code generation and verification, so your application doesn't need to generate or store the codes. Use /otp/send to request delivery and /otp/verify to verify the code your user entered."},
  {q:"Can I Use SecondFactor for Signup Verification and Two-Factor Authentication?",a:"Yes, you can verify phone numbers during signup or add an OTP step alongside another authentication factor, such as a password."},
  {q:"How Much Does OTP Delivery Cost?",a:"Pricing depends on the destination and your pricing arrangement. Check the pricing page for available rates, or contact our team to discuss your expected volume and channel requirements."},
  {q:"Can I Test SecondFactor Before Going Live?",a:"New accounts receive free credits to test real OTP delivery in the PIE Playground, inspect the selected route, and verify the code received."},
  {q:"Can I See Whether an OTP Was Delivered?",a:"Your dashboard includes OTP logs showing the destination, delivery channel, status, and cost of each request."}
];

const CHANNELS_FAQS = [
  {q:"Which OTP Channels Does SecondFactor Support?",a:"SecondFactor supports OTP delivery through SMS, WhatsApp, Viber, and RCS. Availability depends on the destination, recipient capabilities, and completed channel setup."},
  {q:"Do I Need to Connect All Four Channels?",a:"You can start with the channels you need and add others later. Routing and fallback use only the channels enabled and eligible for your requests."},
  {q:"Do I Need a Separate Integration for Each Channel?",a:"Your application uses one SecondFactor API for sending and verifying OTPs. Each channel may require its own business account, sender registration, or template approval."},
  {q:"Which Channel Is the Cheapest?",a:"The lowest-cost option depends on the destination and applicable rates. SecondFactor evaluates eligible channels for each request rather than always choosing the same channel."},
  {q:"Will Enabling More Channels Always Reduce My Costs?",a:"Additional channels can provide lower-cost options, but savings depend on their pricing and eligibility for your traffic. A connected channel may not be available for every recipient."},
  {q:"What Happens if the First Channel Doesn't Deliver?",a:"If delivery isn't confirmed within eight seconds, SecondFactor tries the next eligible channel. Fallback requires another channel to be enabled and available for that request."},
  {q:"Can I Use the Same Message Across All Channels?",a:"You can manage templates together, but the message content must follow each channel's rules. WhatsApp authentication templates, for example, use prescribed wording and supported configuration options."},
  {q:"How Can I See Which Channel Was Used?",a:"Your OTP logs show the delivery channel, destination, status, and cost of each request."}
];

const CHANNEL_PAGES = {
  sms:{
    name:"SMS OTP", eyebrow:"SMS OTP API",
    h1:"Send and Verify OTPs Through SMS",
    sub:"Add SMS verification to your app through one API that handles code generation, delivery, and verification, with automatic routing across your eligible channels.",
    s2title:"Reach Users Without Requiring a Messaging App",
    s2sub:"Send verification codes to mobile numbers through SMS, including users who cannot receive them through WhatsApp, Viber, or RCS.",
    features:[
      {t:"Managed OTP Verification",d:"Let SecondFactor generate and verify codes without building OTP storage and validation into your backend."},
      {t:"Cost-Based Routing",d:"Evaluate SMS alongside your other enabled channels to select the lowest-cost eligible route for each request."},
      {t:"Automatic Fallback",d:"Use SMS as a fallback when another channel doesn't confirm delivery and SMS is the next eligible route."},
      {t:"Delivery Logs and Costs",d:"Check the destination, delivery status, and cost of each request to monitor usage and investigate delivery issues."}
    ],
    s3title:"Add SMS Verification With Two API Calls",
    s3sub:"Complete the applicable sender and template setup, then connect your application to SecondFactor's send-and-verify API.",
    steps:[
      {n:"01",t:"Request an OTP",d:"Call /otp/send with the user's phone number to generate a code, request delivery, and receive a request ID."},
      {n:"02",t:"Verify the Code",d:"Call /otp/verify with the request ID and the code your user entered to receive the verification result."}
    ],
    s4title:"Manage Your SMS Sender and Verification Templates",
    s4sub:"Set up your SMS messages through SecondFactor, with sender requirements based on the countries where you plan to deliver codes.",
    s4items:[
      {t:"Sender Setup by Destination",d:"Complete the sender registration required for your destination markets, including branded sender approval where applicable."},
      {t:"Custom OTP Messages",d:"Create an SMS authentication template with your app name and verification code placeholder, then submit it for review."},
      {t:"Message Length and Encoding",d:"Keep templates concise and review their encoding, since longer messages and some character sets can increase the number of billable SMS segments."}
    ],
    s5title:"Use SMS OTPs for Signup and Account Access",
    uc1:"Ask new users to enter a code sent to their mobile number before completing registration.",
    uc2:"Request an SMS code alongside another authentication factor, such as a password, before granting account access.",
    s6title:"Check SMS OTP Pricing for Your Destination Markets",
    s6sub:"Review rates for the countries where your users are located, or contact our team about pricing for your expected verification volume.",
    s6note:"Connect additional channels to give SecondFactor lower-cost routing options where they are available and eligible.",
    faqs:[
      {q:"Do Users Need an App or Internet Connection to Receive an SMS OTP?",a:"Users do not need a messaging app or mobile data connection to receive a standard SMS. They need a mobile number and access to SMS service, while completing verification in your application may require internet access."},
      {q:"Can I Use My Business Name as the SMS Sender?",a:"Branded sender availability depends on the destination. Some markets require registration and approval before your business name can appear as the sender."},
      {q:"Can I Customize the SMS Message?",a:"You can create an authentication template using your app name and OTP placeholder, subject to review and destination requirements. Message length and encoding can affect the number of SMS segments."},
      {q:"Will Every OTP Request Be Sent Through SMS?",a:"SecondFactor's routing engine selects the lowest-cost eligible channel for each request. If you enable additional channels, a request may use one of those instead of SMS."},
      {q:"Can SMS Be Used as a Fallback for WhatsApp?",a:"Yes, SMS can be used when WhatsApp delivery isn't confirmed and SMS is the next eligible channel. You need to enable SMS and complete any applicable sender and template setup."},
      {q:"What Happens if SMS Delivery Isn't Confirmed?",a:"SecondFactor attempts the next eligible channel after eight seconds without delivery confirmation. Fallback depends on another channel being enabled and available for the recipient."},
      {q:"How Much Does an SMS OTP Cost?",a:"Pricing depends on the destination and your pricing arrangement. Review the pricing page or contact our team to understand applicable charges, including how message segments and fallback are billed."},
      {q:"Can I Test SMS OTP Delivery Before Integrating?",a:"New accounts receive free credits to test real OTP delivery through the PIE Playground. The result shows which eligible channel handled your request, and you can enter the received code to test verification."}
    ],
    ctaTitle:"Start Testing Your SMS OTP Integration",
    ctaSub:"Create an account to test OTP delivery, or talk to our team about SMS setup and pricing for your destination markets."
  },
  whatsapp:{
    name:"WhatsApp OTP", eyebrow:"WhatsApp OTP API",
    h1:"Send Verification Codes Through WhatsApp",
    sub:"Send and verify WhatsApp OTPs through one API, with cost-based routing and automatic fallback to another eligible channel when delivery isn't confirmed.",
    s2title:"Add WhatsApp to Your OTP Delivery Options",
    s2sub:"Give your application another way to reach users and reduce delivery costs where WhatsApp offers a lower-priced route.",
    features:[
      {t:"Cost-Based Routing",d:"Let SecondFactor select WhatsApp when it is the lowest-cost eligible channel for your request."},
      {t:"Automatic Fallback",d:"Try the next eligible channel if WhatsApp delivery isn't confirmed within eight seconds."},
      {t:"Managed OTP Verification",d:"Use SecondFactor to generate and verify codes without building OTP storage and validation into your backend."},
      {t:"Delivery Visibility",d:"Review the channel, delivery status, and cost of each OTP request from your dashboard."}
    ],
    s3title:"Connect Your Account and Start Sending WhatsApp OTPs",
    s3sub:"Link your WhatsApp Business Account, get an authentication template approved, then call the same send-and-verify API.",
    steps:[
      {n:"01",t:"Connect WhatsApp",d:"Link your WhatsApp Business Account through the SecondFactor dashboard and complete the applicable business and sender setup."},
      {n:"02",t:"Set Up an Authentication Template",d:"Submit a WhatsApp authentication template and track its approval before using it to send codes."},
      {n:"03",t:"Integrate the OTP API",d:"Use /otp/send to request a code and /otp/verify to check the code entered by your user."}
    ],
    s4title:"Manage Your WhatsApp Authentication Templates",
    s4sub:"Create and submit authentication templates from SecondFactor, with wording and options that follow WhatsApp's authentication format.",
    s4items:[
      {t:"Standard Verification Message",d:"Use WhatsApp's prescribed authentication message to deliver your verification code."},
      {t:"Security and Expiry Information",d:"Include the supported security disclaimer and expiry warning when configuring your template."},
      {t:"Approval Tracking",d:"Check template status from your dashboard so you know when it is ready to use."}
    ],
    s5title:"Use WhatsApp OTPs in Your Signup and Login Flows",
    uc1:"Ask new users to enter a code delivered through WhatsApp to verify their phone number during registration.",
    uc2:"Use a WhatsApp OTP alongside another authentication factor, such as a password, before granting account access.",
    s6title:"Check WhatsApp OTP Pricing for Your Destination Markets",
    s6sub:"Review pricing for the countries where your users are located, or talk to our team about your expected volume and channel setup.",
    s6note:"SecondFactor's routing engine evaluates WhatsApp alongside your other eligible channels to select the lowest-cost available route.",
    faqs:[
      {q:"Do I Need a WhatsApp Business Account?",a:"Yes, you need to connect a WhatsApp Business Account and complete the applicable sender setup and template approvals before sending WhatsApp OTPs through SecondFactor."},
      {q:"Does the Recipient Need WhatsApp?",a:"Yes, the recipient's number must be registered with WhatsApp and able to receive the message. If delivery isn't confirmed, SecondFactor can try another eligible channel enabled for your account."},
      {q:"Can I Customize the Verification Message?",a:"WhatsApp authentication templates use prescribed wording rather than a fully custom message. Supported options include a security disclaimer and an expiry warning, which you can configure when setting up the template."},
      {q:"Is WhatsApp Always Cheaper Than SMS?",a:"The lower-cost option depends on the destination and applicable rates. SecondFactor evaluates eligible channels for each request rather than assuming WhatsApp will always cost less."},
      {q:"Will Every OTP Be Sent Through WhatsApp Once I Connect It?",a:"Connecting WhatsApp makes it available to the routing engine. SecondFactor selects the lowest-cost eligible channel for each request, so another channel may be used when it offers a lower-priced route."},
      {q:"What Happens if the WhatsApp OTP Is Not Delivered?",a:"If delivery isn't confirmed within eight seconds, SecondFactor attempts the next eligible channel. Available fallback options depend on your connected channels and the recipient's capabilities."},
      {q:"Do I Need a Separate API Integration for SMS Fallback?",a:"The same SecondFactor API handles delivery across supported channels. You need to enable SMS and complete any applicable setup, but your application does not need a separate SMS integration."}
    ],
    ctaTitle:"Add WhatsApp to Your OTP Integration",
    ctaSub:"Create your SecondFactor account to connect WhatsApp, or talk to our team about setup and pricing for your application."
  },
  viber:{
    name:"Viber OTP", eyebrow:"Viber OTP API",
    h1:"Send and Verify OTPs Through Viber",
    sub:"Reach Viber users through one API that handles code generation, delivery, and verification, with cost-based routing and automatic fallback when delivery isn't confirmed.",
    s2title:"Add Viber as a Lower-Cost OTP Delivery Option",
    s2sub:"Give SecondFactor another route to reach your users in markets where Viber is available and offers lower delivery costs.",
    features:[
      {t:"Cost-Based Routing",d:"Use Viber when it is the lowest-cost eligible channel for your request."},
      {t:"Automatic Fallback",d:"Try the next eligible channel if Viber delivery isn't confirmed within eight seconds."},
      {t:"Branded Business Sender",d:"Deliver verification messages under your approved Viber business name so users can recognize the sender."},
      {t:"Delivery Logs and Costs",d:"Review the channel, delivery status, and cost of each request from your dashboard."}
    ],
    s3title:"Set Up Your Viber Sender and Connect the API",
    s3sub:"Viber delivery needs an approved business sender and a reviewed template before live traffic.",
    steps:[
      {n:"01",t:"Apply for a Business Sender",d:"Submit your business details and the required documents through SecondFactor's onboarding process for Viber sender approval."},
      {n:"02",t:"Create an OTP Template",d:"Add your verification message, app name, and OTP placeholder, then submit the template for review."},
      {n:"03",t:"Send and Verify Codes",d:"Use /otp/send to request delivery and /otp/verify to check the code entered by your user once your sender and template are approved."}
    ],
    s4title:"Create Viber Verification Messages for Your App",
    s4sub:"Write an authentication message that identifies your app and tells users what the code is for.",
    s4items:[
      {t:"Custom Authentication Wording",d:"Create your own OTP message within the applicable Viber content rules and SecondFactor's template review requirements."},
      {t:"Shared Template Management",d:"Manage Viber templates alongside your other channels, with separate message content where channel requirements differ."},
      {t:"Approval Tracking",d:"Check your template's status from the dashboard before using it for live delivery."}
    ],
    s5title:"Use Viber OTPs for Signup and Account Access",
    uc1:"Ask users to enter a code delivered through Viber to verify their phone number during registration.",
    uc2:"Use a Viber OTP alongside another authentication factor, such as a password, before granting account access.",
    s6title:"Review Viber OTP Pricing for Your Markets",
    s6sub:"Talk to our team about Viber availability, sender setup, and pricing for the countries where your users are located.",
    s6note:"Once connected, Viber becomes another option for SecondFactor's routing engine to evaluate alongside your other eligible channels.",
    faqs:[
      {q:"Does the Recipient Need Viber?",a:"Yes, the recipient needs an active Viber account associated with the destination number and internet access to receive the message."},
      {q:"Do I Need an Approved Business Sender?",a:"Yes, Viber delivery requires business sender approval. SecondFactor's onboarding process collects the business information and documentation needed for the application."},
      {q:"Can I Start Sending Immediately After Signing Up?",a:"You can explore SecondFactor after signing up, but live Viber delivery requires an approved sender and authentication template. Approval timing depends on the application and review process."},
      {q:"Can I Customize the OTP Message?",a:"You can create custom authentication wording with your app name and OTP placeholder, subject to the applicable content rules and template review."},
      {q:"Is Viber Cheaper Than SMS?",a:"Viber may offer a lower-cost route in some markets, but the price depends on the destination and applicable rates. SecondFactor selects among eligible channels for each request."},
      {q:"What Happens if the User Cannot Receive the Viber Message?",a:"If delivery isn't confirmed within eight seconds, SecondFactor attempts the next eligible channel. Fallback requires another channel to be enabled for your account and available for the recipient."},
      {q:"Do I Need a Separate Integration for Viber?",a:"Your application uses the same SecondFactor send-and-verify API across supported channels. You need to complete Viber sender and template setup, but you do not need to build a separate Viber delivery integration."},
      {q:"Will Every OTP Use Viber Once It Is Connected?",a:"Connecting Viber makes it available to the routing engine. SecondFactor may select another channel when it is the lower-cost eligible option for that request."}
    ],
    ctaTitle:"Add Viber to Your OTP Delivery Options",
    ctaSub:"Create your SecondFactor account, or talk to our team about Viber sender approval and pricing for your application."
  },
  rcs:{
    name:"RCS OTP", eyebrow:"RCS OTP API",
    h1:"Send and Verify OTPs Through RCS",
    sub:"Deliver verification codes to supported devices through one API, with cost-based routing and automatic fallback when RCS delivery isn't confirmed.",
    s2title:"Add RCS to Your OTP Delivery Options",
    s2sub:"Reach eligible users through their phone's messaging app and give SecondFactor another delivery route to evaluate for each request.",
    features:[
      {t:"Recipient Eligibility Checks",d:"Check whether the recipient's device and carrier support RCS before attempting delivery through the channel."},
      {t:"Cost-Based Routing",d:"Use RCS when it is the lowest-cost eligible option among your connected channels."},
      {t:"Automatic Fallback",d:"Try the next eligible channel if RCS delivery isn't confirmed within eight seconds."},
      {t:"Delivery Logs and Costs",d:"Review the channel, delivery status, and cost of each OTP request from your dashboard."}
    ],
    s3title:"Register Your RCS Sender and Connect the API",
    s3sub:"RCS needs an approved business sender, also called an agent, before live verification traffic.",
    steps:[
      {n:"01",t:"Submit Your Business Details",d:"Provide your business name, logo, and required brand information through SecondFactor's RCS sender application process."},
      {n:"02",t:"Complete Sender and Template Approval",d:"Complete the applicable RCS sender review and submit your authentication template before sending live verification codes."},
      {n:"03",t:"Send and Verify OTPs",d:"Use /otp/send to request a code and /otp/verify to check the code entered by your user."}
    ],
    s4title:"Help Users Recognize Your Verification Messages",
    s4sub:"Set up an approved RCS business sender with your brand details so recipients can identify where their verification code came from.",
    s4items:[
      {t:"Business Name and Logo",d:"Associate your verification messages with the business identity approved during RCS sender registration."},
      {t:"Authentication Templates",d:"Create OTP messages using your app name and verification code placeholder, subject to the applicable content and approval requirements."},
      {t:"Centralized Template Management",d:"Manage RCS authentication templates alongside your SMS, WhatsApp, and Viber templates in SecondFactor."}
    ],
    s5title:"Use RCS OTPs for Signup and Account Access",
    uc1:"Ask users on supported devices to enter a code delivered through RCS before completing registration.",
    uc2:"Request an RCS OTP alongside another authentication factor, such as a password, before granting account access.",
    s6title:"Check RCS Availability and Pricing for Your Markets",
    s6sub:"Talk to our team about supported destinations, sender requirements, and RCS OTP pricing for your expected volume.",
    s6note:"SecondFactor evaluates RCS alongside your other eligible channels to select the lowest-cost available route for each request.",
    faqs:[
      {q:"Can Every Phone Receive RCS OTPs?",a:"RCS business message availability depends on the recipient's device, messaging setup, carrier, and market. SecondFactor checks recipient eligibility before attempting RCS delivery."},
      {q:"Do Recipients Need WhatsApp or Viber?",a:"Recipients receive RCS messages through a compatible phone messaging app. They do not need WhatsApp or Viber, but RCS must be supported and available on their device."},
      {q:"Do I Need an Approved RCS Business Sender?",a:"Yes, you need to register an RCS business sender, also called an agent, and complete the applicable approval process before sending live messages."},
      {q:"How Long Does RCS Setup Take?",a:"Setup includes a sender application and review, so it is not immediate. Our team can explain the requirements and expected timing for your application."},
      {q:"What Happens if a Recipient Does Not Support RCS?",a:"RCS is excluded from the eligible delivery options, allowing SecondFactor to select another available channel enabled for your account."},
      {q:"What Happens if RCS Delivery Isn't Confirmed?",a:"SecondFactor attempts the next eligible channel after eight seconds without delivery confirmation. Available fallback options depend on your connected channels and the recipient's capabilities."},
      {q:"Is RCS Always Cheaper Than SMS?",a:"The lower-cost option depends on destination pricing and applicable rates. SecondFactor evaluates eligible routes for each request rather than always choosing RCS."},
      {q:"Do I Need a Separate API Integration for RCS?",a:"Your application uses the same SecondFactor send-and-verify API across supported channels. RCS requires its own sender and template setup, but no separate delivery integration in your application."}
    ],
    ctaTitle:"Add RCS to Your OTP Integration",
    ctaSub:"Contact our team to confirm RCS availability, discuss sender approval, and review pricing for your destination markets."
  }
};

window.SF = {RATES:RATES, CHANNEL_META:CHANNEL_META};
})();
