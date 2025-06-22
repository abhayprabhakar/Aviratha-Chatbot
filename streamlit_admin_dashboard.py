import streamlit as st
import os
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
import re
import glob
import time
from datetime import datetime

# Check for PyPDF2
try:
    import PyPDF2
except ImportError:
    st.error("PyPDF2 library is required. Install it with: `pip install PyPDF2`")
    st.stop()

# Try importing optional dependencies
try:
    import pycryptodome
    HAS_PYCRYPTODOME = True
except ImportError:
    HAS_PYCRYPTODOME = False

# Path to knowledge base folder
KNOWLEDGE_BASE_PATH = Path("knowledge-base")

# Set up the page
st.set_page_config(page_title="Aviratha Knowledge Base Dashboard", layout="wide")
st.title("🌱 Hydroponics Knowledge Base Dashboard")

# Initialize session state for file cache
if "file_data" not in st.session_state:
    st.session_state["file_data"] = None
    st.session_state["last_scan_time"] = None

# Function to extract text from PDF
def extract_pdf_text(file_path):
    try:
        with open(file_path, "rb") as file:
            reader = PyPDF2.PdfReader(file)
            
            # Check if PDF is encrypted
            if reader.is_encrypted:
                return "[This PDF is encrypted and cannot be read without a password]"
                
            text = ""
            for page in reader.pages:
                try:
                    page_text = page.extract_text()
                    text += page_text + "\n" if page_text else "[Empty page]\n"
                except Exception as page_error:
                    text += f"[Error extracting page: {str(page_error)}]\n"
            return text
    except PyPDF2.errors.PdfReadError:
        return "[Error: This PDF appears to be damaged or uses unsupported features]"
    except Exception as e:
        error_msg = str(e)
        if "PyCryptodome" in error_msg:
            return "[Error: This PDF requires PyCryptodome library. Install with 'pip install pycryptodome']"
        return f"[Error extracting text: {error_msg}]"

# Function to estimate reading time
def estimate_reading_time(text):
    # Average reading speed: 200 words per minute
    word_count = len(text.split())
    minutes = word_count / 200
    return minutes

# Scan knowledge base files
@st.cache_data(ttl=300)  # Cache for 5 minutes
def scan_knowledge_base():
    files_data = []
    categories = []
    
    # Check if knowledge base folder exists
    if not KNOWLEDGE_BASE_PATH.exists():
        return [], []
    
    # Get all categories (subfolders)
    for category_path in KNOWLEDGE_BASE_PATH.iterdir():
        if category_path.is_dir():
            category_name = category_path.name
            categories.append(category_name)
            
            # Get all PDFs in this category
            for pdf_file in category_path.glob("*.pdf"):
                file_stat = pdf_file.stat()
                
                # Extract first 1000 chars of text for preview
                text = extract_pdf_text(pdf_file)
                preview = text[:1000] + "..." if len(text) > 1000 else text
                
                # Count pages
                with open(pdf_file, "rb") as file:
                    reader = PyPDF2.PdfReader(file)
                    page_count = len(reader.pages)
                
                files_data.append({
                    "fileName": pdf_file.name,
                    "filePath": str(pdf_file),
                    "category": category_name,
                    "fileSize": file_stat.st_size,
                    "fileSizeKB": file_stat.st_size / 1024,
                    "createdAt": datetime.fromtimestamp(file_stat.st_ctime),
                    "modifiedAt": datetime.fromtimestamp(file_stat.st_mtime),
                    "pageCount": page_count,
                    "textPreview": preview,
                    "wordCount": len(text.split()),
                    "readingTimeMinutes": estimate_reading_time(text)
                })
                
    return files_data, categories

# Sidebar controls
with st.sidebar:
    st.header("Knowledge Base Explorer")
    
    # Show warnings for missing packages
    if not HAS_PYCRYPTODOME:
        st.warning("PyCryptodome not installed. Some encrypted PDFs may not be readable. Install with: `pip install pycryptodome`")
    
    # Scan button
    if st.button("Scan Knowledge Base"):
        with st.spinner("Scanning files..."):
            st.session_state["file_data"], categories = scan_knowledge_base()
            st.session_state["last_scan_time"] = datetime.now()
        st.success(f"Found {len(st.session_state['file_data'])} files in {len(categories)} categories")

    # Display last scan time
    if st.session_state["last_scan_time"]:
        st.info(f"Last scanned: {st.session_state['last_scan_time'].strftime('%H:%M:%S')}")
    
    st.divider()
    
    # About section
    st.markdown("**About this dashboard**")
    st.markdown(
        "This dashboard provides insights into the Aviratha hydroponics knowledge base. "
        "It analyzes PDF files to extract statistics and provide an overview of the available information."
    )

# Main content
if st.session_state["file_data"] is None:
    st.info("Click 'Scan Knowledge Base' in the sidebar to get started")
else:
    files_data = st.session_state["file_data"]
    
    if not files_data:
        st.warning("No PDF files found in the knowledge base folder")
    else:
        df = pd.DataFrame(files_data)
        
        # Knowledge Base Summary Stats
        st.header("📊 Knowledge Base Statistics")
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("Total Documents", len(df))
        with col2:
            total_size_mb = round(df["fileSize"].sum() / (1024 * 1024), 2)
            st.metric("Total Size", f"{total_size_mb} MB")
        with col3:
            total_pages = df["pageCount"].sum()
            st.metric("Total Pages", total_pages)
        with col4:
            total_reading_time = round(df["readingTimeMinutes"].sum(), 1)
            st.metric("Est. Reading Time", f"{total_reading_time} mins")
        
        # Category information
        st.header("🗂️ Categories Overview")
        category_stats = df.groupby("category").agg({
            "fileName": "count",
            "fileSize": "sum",
            "pageCount": "sum",
            "wordCount": "sum"
        }).reset_index()
        
        category_stats = category_stats.rename(columns={
            "fileName": "Files",
            "fileSize": "Total Size (bytes)",
            "pageCount": "Total Pages",
            "wordCount": "Total Words"
        })
        
        # Display as table
        st.dataframe(category_stats, use_container_width=True)
        
        # Visualizations
        st.header("📈 Knowledge Base Analytics")
        
        tabs = st.tabs(["Categories", "File Sizes", "Reading Time"])
        
        with tabs[0]:
            col1, col2 = st.columns(2)
            
            with col1:
                # Bar chart of files by category
                st.subheader("Files per Category")
                category_counts = df["category"].value_counts()
                st.bar_chart(category_counts)
            
            with col2:
                # Pie chart of categories
                st.subheader("Category Distribution")
                fig, ax = plt.subplots()
                ax.pie(category_counts, labels=category_counts.index, autopct='%1.1f%%')
                ax.axis('equal')
                st.pyplot(fig)
        
        with tabs[1]:
            # File size distribution
            st.subheader("File Size Distribution")
            
            fig, ax = plt.subplots(figsize=(10, 5))
            ax.hist(df["fileSizeKB"], bins=10, edgecolor='black')
            ax.set_xlabel("File Size (KB)")
            ax.set_ylabel("Number of Files")
            st.pyplot(fig)
            
            # Largest files
            st.subheader("Largest Files")
            largest_files = df.sort_values("fileSize", ascending=False).head(5)
            st.dataframe(
                largest_files[["fileName", "category", "fileSizeKB", "pageCount"]],
                use_container_width=True
            )
        
        with tabs[2]:
            # Reading time distribution
            st.subheader("Reading Time Distribution")
            
            fig, ax = plt.subplots(figsize=(10, 5))
            ax.hist(df["readingTimeMinutes"], bins=10, edgecolor='black')
            ax.set_xlabel("Reading Time (minutes)")
            ax.set_ylabel("Number of Files")
            st.pyplot(fig)
            
            # Longest reads
            st.subheader("Longest Reading Times")
            longest_reads = df.sort_values("readingTimeMinutes", ascending=False).head(5)
            st.dataframe(
                longest_reads[["fileName", "category", "pageCount", "readingTimeMinutes"]],
                use_container_width=True
            )
        
        # Document explorer
        st.header("🔍 Document Explorer")
        
        # Filter controls
        col1, col2 = st.columns(2)
        
        with col1:
            selected_category = st.selectbox(
                "Filter by Category",
                options=["All Categories"] + sorted(df["category"].unique().tolist())
            )
        
        with col2:
            search_term = st.text_input("Search by filename:")
          # Apply filters
        filtered_df = df.copy()
        if selected_category != "All Categories":
            filtered_df = filtered_df[filtered_df["category"] == selected_category]
        
        if search_term:
            filtered_df = filtered_df[filtered_df["fileName"].str.contains(search_term, case=False)]
        
        # Show filtered documents
        if not filtered_df.empty:
            st.subheader(f"Found {len(filtered_df)} documents")
            for i, (_, row) in enumerate(filtered_df.iterrows()):
                with st.expander(f"{row['fileName']} ({row['category']})"):
                    col1, col2 = st.columns([2, 1])
                    
                    with col1:
                        st.markdown("#### Document Preview")
                        # Add unique key to the text_area
                        st.text_area(
                            "Content Preview", 
                            row["textPreview"], 
                            height=200, 
                            key=f"preview_{i}_{row['fileName'].replace('.', '_')}"
                        )
                    
                    with col2:
                        st.markdown("#### Document Details")
                        st.markdown(f"**Size:** {row['fileSizeKB']:.2f} KB")
                        st.markdown(f"**Pages:** {row['pageCount']}")
                        st.markdown(f"**Word Count:** {row['wordCount']}")
                        st.markdown(f"**Reading Time:** {row['readingTimeMinutes']:.1f} minutes")
                        st.markdown(f"**Last Modified:** {row['modifiedAt'].strftime('%Y-%m-%d')}")
        else:
            st.warning("No documents match your filters")