// This file contains intentionally bad code for testing WOARU's review functionality
// DO NOT USE THIS CODE IN PRODUCTION - IT'S DESIGNED TO TRIGGER CODE SMELL ALERTS

import * as fs from 'fs';

// Code Smell 1: Extremely long function with multiple responsibilities (violates SRP)
function processUserDataAndGenerateReportAndSendEmailAndLogEverything(userData: any, emailConfig: any, logLevel: string, reportType: string, outputFormat: string) {
    // Code Smell 2: No input validation
    let result;
    
    // Code Smell 3: Inconsistent variable naming and unused variables
    let userName = userData.name;
    let user_email = userData.email;
    let userAge = userData.age;
    let unusedVariable = "this is never used";
    let anotherUnusedVar = 123;
    
    // Code Smell 4: Magic numbers and hardcoded values
    if (userAge > 18 && userAge < 120) {
        // Code Smell 5: Deep nesting and complex conditional logic
        if (reportType == "detailed") {
            if (outputFormat == "pdf") {
                if (emailConfig.enabled == true) {
                    if (logLevel == "debug" || logLevel == "info" || logLevel == "warn") {
                        // Code Smell 6: String concatenation instead of template literals
                        let message = "Processing user: " + userName + " with email: " + user_email + " age: " + userAge;
                        console.log(message);
                        
                        // Code Smell 7: Synchronous file operations (blocking)
                        try {
                            let data = fs.readFileSync('/tmp/userdata.json', 'utf8');
                            let parsedData = JSON.parse(data);
                            
                            // Code Smell 8: Mutation of input parameters
                            userData.processed = true;
                            userData.timestamp = new Date();
                            
                            // Code Smell 9: No error handling for critical operations
                            result = generateComplexReport(parsedData, userData);
                            sendEmail(user_email, result);
                            
                        } catch (e) {
                            // Code Smell 10: Poor error handling - catching everything
                            console.log("Something went wrong");
                        }
                    }
                }
            }
        }
    }
    
    // Code Smell 11: Function returns different types
    if (result) {
        return result;
    } else {
        return false;
    }
}

// Code Smell 12: Function with too many parameters
function calculateComplexBusinessLogic(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) {
    // Code Smell 13: Comments explaining what code does instead of why
    // Add a to b
    let sum1 = a + b;
    // Multiply c with d
    let product1 = c * d;
    // Divide e by f
    let division1 = e / f;
    
    return sum1 + product1 + division1; // No validation for division by zero
}

// Code Smell 14: God class - too many responsibilities
class DataProcessorEmailSenderLoggerConfigurationManagerUserValidator {
    private data: any;
    private config: any;
    private logger: any;
    private validator: any;
    private emailService: any;
    private database: any;
    private cache: any;
    private analytics: any;
    
    constructor(data: any) {
        this.data = data;
        // Code Smell 15: Constructor doing too much work
        this.initializeEverything();
        this.connectToDatabase();
        this.setupLogging();
        this.validateAllData();
        this.preloadCache();
    }
    
    // Code Smell 16: Methods with unclear names and side effects
    public doStuff() {
        this.processData();
        this.sendEmails();
        this.updateDatabase();
        this.clearCache();
        return "done";
    }
    
    // Code Smell 17: Duplicated code
    private processData() {
        if (this.data.length > 0) {
            for (let i = 0; i < this.data.length; i++) {
                console.log("Processing item: " + i);
                // Process item
            }
        }
    }
    
    private processOtherData() {
        if (this.data.length > 0) {
            for (let i = 0; i < this.data.length; i++) {
                console.log("Processing item: " + i);
                // Process item differently (but mostly the same)
            }
        }
    }
    
    // Code Smell 18: Empty methods
    private initializeEverything() {
        // TODO: Implement this
    }
    
    private connectToDatabase() {
        // TODO: Add database connection
    }
    
    private setupLogging() {
        // TODO: Setup logging
    }
    
    private validateAllData() {
        // TODO: Validate data
    }
    
    private preloadCache() {
        // TODO: Preload cache
    }
    
    private sendEmails() {
        // TODO: Send emails
    }
    
    private updateDatabase() {
        // TODO: Update database
    }
    
    private clearCache() {
        // TODO: Clear cache
    }
}

// Code Smell 19: Global variables
var globalCounter = 0;
let globalData: any;
const GLOBAL_CONFIG = {
    timeout: 5000,
    retries: 3
};

// Code Smell 20: Function that modifies global state
function incrementGlobalCounter() {
    globalCounter++;
    globalData = { count: globalCounter };
}

// Code Smell 21: Overly complex regular expression without explanation
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Code Smell 22: Functions that should return values but don't
function generateComplexReport(data: any, userData: any) {
    console.log("Generating report...");
    // Missing return statement
}

function sendEmail(email: string, content: any) {
    console.log("Sending email to: " + email);
    // Missing implementation and return
}

// Code Smell 23: Switch statement that should be polymorphism
function processUserByType(user: any) {
    switch (user.type) {
        case "admin":
            console.log("Processing admin user");
            // 50 lines of admin logic here
            break;
        case "regular":
            console.log("Processing regular user");
            // 50 lines of regular user logic here
            break;
        case "guest":
            console.log("Processing guest user");
            // 50 lines of guest logic here
            break;
        case "premium":
            console.log("Processing premium user");
            // 50 lines of premium logic here
            break;
        default:
            console.log("Unknown user type");
    }
}

// Code Smell 24: Inconsistent code style and formatting
function badlyFormattedFunction(param1:string,param2:number   ,   param3  :boolean){
let x=param1.length;
if(x>10){
return true;
}else
{
return false;
}
}

// Code Smell 25: Memory leaks and resource management issues
class LeakyClass {
    private intervals: NodeJS.Timeout[] = [];
    
    public startProcessing() {
        // Code Smell: Creating intervals without cleanup
        this.intervals.push(setInterval(() => {
            console.log("Processing...");
        }, 1000));
        
        this.intervals.push(setInterval(() => {
            console.log("More processing...");
        }, 2000));
    }
    
    // Missing cleanup method for intervals
}

// Export the problematic code for testing
export {
    processUserDataAndGenerateReportAndSendEmailAndLogEverything,
    calculateComplexBusinessLogic,
    DataProcessorEmailSenderLoggerConfigurationManagerUserValidator,
    incrementGlobalCounter,
    processUserByType,
    badlyFormattedFunction,
    LeakyClass
};