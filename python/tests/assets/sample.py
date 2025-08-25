def greet(name):
    print(f"Hello, {name}!")

def add(a, b):
    return a + b

def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n - 1)

def is_even(num):
    return num % 2 == 0

def main():
    greet("Alice")
    x = 5
    y = 7
    print(f"{x} + {y} = {add(x, y)}")
    print(f"Factorial of {x} is {factorial(x)}")
    if is_even(x):
        print(f"{x} is even")
    else:
        print(f"{x} is odd")

if __name__ == "__main__":
    main()