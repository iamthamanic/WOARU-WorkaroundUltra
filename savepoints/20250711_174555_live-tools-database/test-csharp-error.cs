using System;

namespace TestApp
{
    class Program
    {
        static void Main(string[] args)
        {
            int   x   =    42;  // bad spacing
            string message="Hello World";  // no spaces around =
            
            if(x>40){  // no spaces
            Console.WriteLine(message);
            }
            
            var unusedVariable = "This is never used";
            
              Console.WriteLine(  "Bad indentation"  );
        }
        
        // Method with bad formatting
        public  static   int  BadMethod(  int a,int b  )
        {
        return a+b;
        }
    }
}