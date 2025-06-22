from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid
import sqlite3
from werkzeug.utils import secure_filename
import PyPDF2
from datetime import datetime
import json
import requests
import base64

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'md'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Database setup
def init_db():
    conn = sqlite3.connect('documents.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            uploaded_by TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT FALSE,
            preferences TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_pdf(file_path):
    """Extract text from PDF file"""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        
        if not text.strip():
            raise Exception("No text content extracted from PDF")
        
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to process PDF: {str(e)}")

def process_text(file_path):
    """Read text file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read().strip()
    except Exception as e:
        raise Exception(f"Failed to process text file: {str(e)}")

def clean_content(content):
    """Clean and normalize content"""
    content = content.replace('\r\n', '\n')
    content = content.replace('\n\n\n', '\n\n')
    content = ' '.join(content.split())
    return content.strip()

def generate_title(filename, content):
    """Generate a title from filename and content"""
    # Use filename without extension as title
    title = filename.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ')
    return title[:100]  # Limit title length

def save_document(title, content, filename, file_type, file_size, session_id, is_public):
    """Save document to database"""
    doc_id = str(uuid.uuid4())
    conn = sqlite3.connect('documents.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO documents (id, title, content, file_name, file_type, file_size, uploaded_by, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (doc_id, title, content, filename, file_type, file_size, session_id, is_public))
    
    conn.commit()
    conn.close()
    return doc_id

# Routes
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'flask-file-processor'
    })

@app.route('/session', methods=['POST'])
def create_session():
    """Create a new session or return existing one"""
    try:
        data = request.get_json() or {}
        user_id = data.get('userId')  # Next.js session ID
        preferences = json.dumps(data.get('userPreferences', {}))
        
        conn = sqlite3.connect('documents.db')
        cursor = conn.cursor()
        
        # Check if session already exists for this user_id
        if user_id:
            cursor.execute('''
                SELECT session_id FROM sessions WHERE user_id = ?
            ''', (user_id,))
            existing_session = cursor.fetchone()
            
            if existing_session:
                conn.close()
                return jsonify({
                    'success': True,
                    'sessionId': existing_session[0],
                    'token': existing_session[0]
                })
        
        # Create new session
        session_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO sessions (session_id, user_id, preferences)
            VALUES (?, ?, ?)
        ''', (session_id, user_id, preferences))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'sessionId': session_id,
            'token': session_id  # Using session_id as token for simplicity
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload and process a file"""
    try:
        # Get session info
        auth_header = request.headers.get('Authorization', '')
        session_id = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        
        if not session_id:
            return jsonify({'success': False, 'error': 'No session token provided'}), 401
        
        # Check if session exists
        conn = sqlite3.connect('documents.db')
        cursor = conn.cursor()
        cursor.execute('SELECT session_id FROM sessions WHERE session_id = ?', (session_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Invalid session'}), 401
        conn.close()
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Get form data
        is_public = request.form.get('isPublic', 'false').lower() == 'true'
        
        # Check file type
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Get file info
        file_size = os.path.getsize(file_path)
        file_type = filename.rsplit('.', 1)[1].lower()
        
        # Process file based on type
        if file_type == 'pdf':
            content = process_pdf(file_path)
        elif file_type in ['txt', 'md']:
            content = process_text(file_path)
        else:
            os.remove(file_path)
            return jsonify({'success': False, 'error': f'Unsupported file type: {file_type}'}), 400
        
        # Clean content
        content = clean_content(content)
        
        if len(content) < 100:
            os.remove(file_path)
            return jsonify({'success': False, 'error': 'Document content is too short to be useful'}), 400
        
        # Generate title
        title = generate_title(filename, content)
        
        # Save to database
        doc_id = save_document(title, content, filename, file_type, file_size, session_id, is_public)
        
        # Clean up temporary file
        os.remove(file_path)
        
        return jsonify({
            'success': True,
            'document': {
                'id': doc_id,
                'title': title,
                'content': content[:500] + '...' if len(content) > 500 else content,
                'fileName': filename,
                'fileType': file_type,
                'fileSize': file_size
            }
        })
        
    except Exception as e:
        # Clean up file if it exists
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/documents', methods=['GET'])
def get_documents():
    """Get documents for a session"""
    try:
        auth_header = request.headers.get('Authorization', '')
        session_id = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        
        if not session_id:
            return jsonify({'success': False, 'error': 'No session token provided'}), 401
        
        conn = sqlite3.connect('documents.db')
        cursor = conn.cursor()
        
        # Get documents for this session or public documents
        cursor.execute('''
            SELECT id, title, file_name, file_type, file_size, created_at, is_public
            FROM documents 
            WHERE uploaded_by = ? OR is_public = 1
            ORDER BY created_at DESC
        ''', (session_id,))
        
        documents = []
        for row in cursor.fetchall():
            documents.append({
                'id': row[0],
                'title': row[1],
                'fileName': row[2],
                'fileType': row[3],
                'fileSize': row[4],
                'createdAt': row[5],
                'isPublic': bool(row[6])
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'documents': documents,
            'stats': {
                'totalDocuments': len(documents),
                'totalSize': sum(doc['fileSize'] for doc in documents)
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/test-pdf', methods=['GET'])
def test_pdf():
    """Test PDF processing with an existing file"""
    try:
        # Look for PDF files in uploads directory
        pdf_files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith('.pdf')]
        
        if not pdf_files:
            return jsonify({'success': False, 'error': 'No PDF files found in uploads directory'}), 404
        
        # Test with the first PDF file
        test_file = pdf_files[0]
        file_path = os.path.join(UPLOAD_FOLDER, test_file)
        
        # Process the PDF
        content = process_pdf(file_path)
        
        return jsonify({
            'success': True,
            'fileName': test_file,
            'contentLength': len(content),
            'contentPreview': content[:500] + '...' if len(content) > 500 else content
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/documents/<document_id>', methods=['DELETE'])
def delete_document(document_id):
    """Delete a document"""
    try:
        # Get session info
        auth_header = request.headers.get('Authorization', '')
        session_id = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        
        if not session_id:
            return jsonify({'success': False, 'error': 'No session token provided'}), 401
        
        conn = sqlite3.connect('documents.db')
        cursor = conn.cursor()
        
        # Check if document exists and belongs to user
        cursor.execute('''
            SELECT id FROM documents 
            WHERE id = ? AND uploaded_by = ?
        ''', (document_id, session_id))
        
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Document not found or access denied'}), 404
        
        # Delete the document
        cursor.execute('DELETE FROM documents WHERE id = ?', (document_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Document deleted successfully'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/identify-plant', methods=['POST'])
def identify_plant():
    """Identify if an image contains a plant and get plant details"""
    try:
        # Get session info
        auth_header = request.headers.get('Authorization', '')
        session_id = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
        
        if not session_id:
            return jsonify({'success': False, 'error': 'No session token provided'}), 401
        
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
            
        # Check if the file is an image
        allowed_image_types = {'jpg', 'jpeg', 'png'}
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if file_ext not in allowed_image_types:
            return jsonify({'success': False, 'error': 'Not a valid image format'}), 400
        
        # Read the file
        image_bytes = file.read()
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Call Plant.id API
        api_key = os.environ.get('PLANTID_API_KEY')
        if not api_key:
            return jsonify({'success': False, 'error': 'Plant.id API key not configured'}), 500
            
        plant_id_url = 'https://api.plant.id/v2/identify'
        payload = {
            'images': [image_base64],
            'modifiers': ['similar_images'],
            'plant_details': ['common_names', 'url', 'wiki_description', 'taxonomy']
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Api-Key': api_key
        }
        
        response = requests.post(plant_id_url, json=payload, headers=headers)
        result = response.json()
        
        # Check if it's a plant
        is_plant = False
        plant_details = {}
        confidence = 0
        
        if result.get('suggestions') and len(result['suggestions']) > 0:
            top_suggestion = result['suggestions'][0]
            confidence = top_suggestion.get('probability', 0) * 100
            
        
        return jsonify({
            'success': True,
            'is_plant': is_plant,
            'plant_details': plant_details,
            'confidence': confidence
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route("/")
def home():
    return "Flask backend is running!"

if __name__ == '__main__':
    init_db()
    print("Flask server starting...")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  POST /session - Create session")
    print("  POST /upload - Upload file")
    print("  GET  /documents - Get documents")
    print("  DELETE /documents/<id> - Delete document")
    print("  GET  /test-pdf - Test PDF processing")
    print("  POST /identify-plant - Identify plant in image")
    app.run(debug=True, host='0.0.0.0', port=5000)
