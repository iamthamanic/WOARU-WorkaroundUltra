# Test Python file with linting errors

def bad_function( ):
    unused_variable = 42
    x=1+2  # no spaces around operators
    print("hello world")  # should be formatted
    if True:
        pass
    
    return x

# Line too long - this comment is intentionally very long to trigger line length warnings from ruff because it exceeds the standard 88 character limit

class BadClass:
    def __init__(self):
        pass
    
    def method(self):
        list = [1,2,3,4,5]  # shadows builtin
        return list