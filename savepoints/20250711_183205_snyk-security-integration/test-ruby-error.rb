# Ruby file with RuboCop violations

class bad_class  # Class name should be CamelCase
  def badMethod(param1,param2)  # Method name should be snake_case
    x=42  # No spaces around operator
    unused_variable = "This is never used"
    
    if x>40  # No spaces around operator
      puts"Hello World"  # No space after puts
    end
    
    # Line too long - this comment is intentionally very long to trigger line length warnings from RuboCop because it exceeds the standard 120 character limit
    
    return x  # Redundant return
  end
  
  # Method with wrong indentation
    def another_method
    puts "Bad indentation"
    end
  
  def empty_method
    # Empty method
  end
end