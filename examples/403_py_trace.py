import openai
import poml

poml.set_trace(trace_dir="pomlruns")

client = openai.OpenAI()


def solve_math(question):
    calc_params = poml.poml("108_math_calculator.poml", context={"question": question}, format="openai_chat")
    response = client.chat.completions.create(model="gpt-4.1", **calc_params)
    answer = response.choices[0].message.content

    verify_params = poml.poml(
        "109_math_verifier.poml", context={"question": question, "answer": answer}, format="openai_chat"
    )
    response = client.chat.completions.create(model="gpt-4.1", **verify_params)
    verification = response.choices[0].message.content

    return {"answer": answer, "verification": verification}


if __name__ == "__main__":
    questions = [
        "What is 12345 times 6789?",
        "What is the square root of 987654321?",
    ]

    for question in questions:
        result = solve_math(question)
        print(f"Question: {question}\nAnswer: {result['answer']}\nVerification: {result['verification']}\n\n")
