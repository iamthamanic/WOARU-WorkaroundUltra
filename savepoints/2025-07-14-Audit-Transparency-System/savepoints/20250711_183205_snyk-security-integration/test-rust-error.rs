// Rust file with formatting and clippy issues

fn main() {
    let x=42;  // No spaces around =
    let unused_variable = "This is never used";
    
    if x>40 {  // No spaces around >
        println!("Hello World");
    }
    
    let mut y = 5;
    y = y + 1;  // Should use += 
    
      println!("Bad indentation");  // Bad indentation
}

// Function with bad formatting
fn   bad_function(  a: i32,b: i32  )->i32{
a+b
}

// Unused function
fn unused_function() {
    println!("This function is never called");
}