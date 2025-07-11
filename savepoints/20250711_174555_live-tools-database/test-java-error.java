public class TestJavaError {
    public static void main(String[] args) {
        int x=42;  // no spaces around =
        String message="Hello World";  // no spaces
        
        if(x>40){  // no spaces
            System.out.println(message);
        }
        
        String unusedVariable = "This is never used";
        
          System.out.println(  "Bad indentation"  );
    }
    
    // Method with bad formatting
    public  static   int  badMethod(  int a,int b  )
    {
    return a+b;
    }
}