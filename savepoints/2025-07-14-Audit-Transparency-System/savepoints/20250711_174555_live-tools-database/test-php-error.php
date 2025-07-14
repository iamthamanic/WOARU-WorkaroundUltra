<?php
// PHP file with PSR-12 violations

class testClass {  // Class name should be PascalCase
    
    public function badMethod($param1,$param2)  // No spaces after commas
    {
        $x=42;  // No spaces around operator
        $unused_variable = "This is never used";
        
        if($x>40){  // No spaces
            echo"Hello World";  // No space after echo
        }
        
        // Line too long - this comment is intentionally very long to trigger line length warnings from PHP_CodeSniffer because it exceeds the standard line length limit for PSR-12 coding standard
        
        return$x;  // No space after return
    }
    
    // Method with wrong indentation
      public function anotherMethod()
      {
      echo "Bad indentation";
      }
}