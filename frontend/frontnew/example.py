from transformers import pipeline

generator = pipeline("text2text-generation", model="microsoft/SQLCoder-7B")
prompt = "Dame una consulta SQL para seleccionar los nombres de empleados de una tabla 'employees'."
result = generator(prompt)
print(result)