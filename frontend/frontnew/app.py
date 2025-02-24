import streamlit as st
import requests
import pandas as pd

st.title("Subir Archivo Excel")

uploaded_file = st.file_uploader("Selecciona un archivo", type=["xlsx", "xls"])

if uploaded_file is not None:
    if st.button("Subir Archivo"):
        files = {"file": (uploaded_file.name, uploaded_file.getvalue())}
        try:
            response = requests.post("http://localhost:3000/upload", files=files)
            if response.status_code == 200:
                st.success("Archivo subido con éxito")
                st.json(response.json())
            else:
                st.error("Error en la subida del archivo")
        except Exception as e:
            st.error(f"Error al subir el archivo: {e}")

# 🔹 Mostrar lista de tablas en la BD
st.header("Tablas Disponibles en la Base de Datos")
try:
    tables_response = requests.get("http://localhost:3000/tables")
    if tables_response.status_code == 200:
        tables = tables_response.json().get("tables", [])
    else:
        st.error("Error al obtener las tablas.")
        tables = []
except Exception as e:
    st.error(f"Error al conectar con el backend: {e}")
    tables = []

# 🔹 Selección de tabla
selected_table = st.selectbox("Selecciona una tabla:", tables) if tables else None

# 🔹 Botón para cargar datos de la tabla seleccionada
if selected_table and st.button("Visualizar datos"):
    try:
        table_data_response = requests.get(f"http://localhost:3000/view-table/{selected_table}")
        if table_data_response.status_code == 200:
            table_data = table_data_response.json().get("data", [])
            if table_data:
                df = pd.DataFrame(table_data)
                st.write("📋 Vista previa de la tabla:")
                st.dataframe(df)
            else:
                st.warning("La tabla está vacía.")
        else:
            st.error("Error al obtener los datos de la tabla.")
    except Exception as e:
        st.error(f"Error al conectar con el backend: {e}")

# 🔹 Campo de texto para el prompt y filtrado de datos
st.header(f"🔎 Filtrar datos en la tabla {selected_table}")
user_prompt = st.text_input("Escribe cómo quieres filtrar los datos:")

if selected_table and user_prompt and st.button("Aplicar Filtro"):
    try:
        filter_response = requests.post(
            "http://localhost:3000/filter-table",
            json={"tableName": selected_table, "prompt": user_prompt}
        )

        if filter_response.status_code == 200:
            filtered_data = filter_response.json().get("data", [])
            if filtered_data:
                df_filtered = pd.DataFrame(filtered_data)
                st.write("📊 Datos Filtrados:")
                st.dataframe(df_filtered)
            else:
                st.warning("No se encontraron resultados con ese filtro.")
        else:
            st.error("Error al aplicar el filtro.")
    except Exception as e:
        st.error(f"Error al conectar con el backend: {e}")