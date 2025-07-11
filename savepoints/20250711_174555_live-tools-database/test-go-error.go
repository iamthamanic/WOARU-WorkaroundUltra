package main

import "fmt"
import "strings"  // unused import

func main(){
fmt.Println("Bad formatting")
       x:=42
  unused := "this variable is not used"
     if x>40{
fmt.Println("x is greater than 40")
	}
}

// This function has bad formatting and potential issues
func   badFunction(  s string  )string{
return strings.ToUpper(s  )
}