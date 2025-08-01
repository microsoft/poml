import os
import poml
import io
import sys
from contextlib import redirect_stdout


def process_example(example_content, output_file):
    """
    Process the example content and return the expected output.
    """
    # Capture stdout
    poml.poml(example_content, format="raw", output_file=output_file, extra_args=["--prettyPrint", "true"])


def generate_expectations():
    """
    Generate the expected output files for the examples.
    """
    examples_dir = os.path.abspath(os.path.dirname(__file__))
    expect_dir = os.path.join(examples_dir, "expects")
    print("Generating expectations in:", expect_dir)

    for example_file in sorted(os.listdir(examples_dir)):
        if example_file.endswith(".poml"):
            print(f"Processing example: {example_file}")
            # Generate the expected output
            process_example(
                os.path.join(examples_dir, example_file),
                os.path.join(expect_dir, example_file.replace(".poml", ".txt")),
            )


if __name__ == "__main__":
    generate_expectations()
