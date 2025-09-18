---
title: (Django) 2. 장고 html
post_order: 2
thumbnail: https://beecrowd.com/wp-content/uploads/2024/04/2022-12-20-HTML5.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Django
tags:
  - Django
  - HTML
  - command
excerpt: Django html 문법
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# html 변수

- `render`의 key(`context={'key' : value}`)

```python
...
# Create your views here.
def index(request):
    # posts_total_list = Post.objects.all() # db SELECT * FROM POST
    posts_total_list = Post.objects.all().order_by('-pk') # db SELECT * FROM POST ... ASC
    
    return render(request, 
                  template_name='blog/index.html',
                  context={'posts':posts_total_list},
                  )
...                  
```

---

```django

...
{% raw %}{% for post in posts %}{% endraw %}
<!-- Featured blog post-->
<div class="card mb-4">
...

```


# django html

- {% raw %}`{% load <target> %}` {% endraw%}
    - django template(static 등)을 가져오겠다 선언
    - {% raw %}`{% static <path> %}`{% endraw %} : static 파일 가져오겠다 선언
{% raw %}
```django
<!DOCTYPE html>
{% load static %}
<html lang="ko">
<head>
...

... lass="card-img-top" src={% static "blog/images/image.png" %} ...
...
```
{% endraw %}
# for

- 비교구문(`==`, `>` , …) 변수와 공백 필요
- {% raw %}`{% for <iter> in <container> %}`{% endraw %}
- {% raw %}`{% endfor %}`{% endraw %}

```html

```

# if

- {% raw %}`{% if <condition> %}`{% endraw %}
- {% raw %}`{% elif <condition> %}`{% endraw %}
- {% raw %}`{% else %}`{% endraw %}
- {% raw %}`{% endif %}`{% endraw %}

```html

```

# url

- {% raw %}`{% url <url_name> %}`{% endraw %}
- `file_download` → `../download/`

```python
# blog\urls.py

# from django_project_practice.urls import urlpatterns
from django.urls import path    
from . import views

urlpatterns = [
    path('', views.index, name='index'), # 127.0.0.1:8000/blog/
    path('<int:pk>/', views.detail, name='pk'), # 127.0.0.1:8000/blog/{pk}/
    path('create/', views.create, name='create'), # 127.0.0.1:8000/blog/create/
    path('createfake/', views.createfake, name='createfake'), # 127.0.0.1:8000/blog/createfake/
    path('download/', views.file_download, name='file_download'), # 127.0.0.1:8000/blog/file_download/
]
```

---
{% raw %}
```html
{% if post_pk.uploaded_file %}
    <a href="{% url 'file_download' %}?path={{ post_pk.uploaded_file }}">{{ post_pk.uploaded_file.name }}</a>
{% endif %}
```
{% endraw %}
# extends

- {% raw %}`{% extends <other_html> %}`{% endraw %} : `<other_html>` layout을 가져옴
-{% raw %}`{% block <block_name> %}`{% endraw %}
    - 코드 영역 설정
- `extends`로 전체 형태를 가져오고 `block`코드를 변경하는 구조
{% raw %}
```html
# blog\templates\_layout\default.html

<!DOCTYPE html>
{% load static %}
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>Blog</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-LN+7fdVzj6u52u30Kp6M/trliBMCMKTyK833zpbD+pXdCLuTusPj697FH4R/5mcr" crossorigin="anonymous">
</head>

<body>

    <!-- navigation -->
    {% include "include/nav.html" %}

    <!-- Page header with logo and tagline-->
    <div class="header">
        <!-- Page header with logo and tagline-->
        <header class="py-5 bg-light border-bottom mb-4">
            <div class="container">
                <div class="text-center my-5">
                    {% block header-msg %}{% endblock %}
                </div>
            </div>
        </header>
    </div>

    <!-- Page content-->
    <div class="container">
        <div class="row">
            <!-- Blog entries-->
            <div class="col-lg-8">
                {% block content %}
                {% endblock %}
            </div>
            
            <!-- Side widgets -->
            <div class="col-lg-4">
                {% include "include/side.html" %}
                <!-- category "Side widget" -->
                <div class="card mb-4">
                    <div class="card-header">Side Widget</div>
                    <a href="/blog/create/"><button class="btn btn-primary" type="button">
                        {% block side-category %}{% endblock %}
                    </button></a>
                </div>
            </div>
        </div>
    </div>

    <!-- Footer-->
    <div class="footer">
        {% include "include/footer.html" %}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js" integrity="sha384-ndDqU0Gzau9qJ1lfW4pNLlhNTkCfHzAVBReH9diLvGRem5+R9g2FzA8ZGN954O5Q" crossorigin="anonymous"></script>
</body>
</html>
```
{% endraw %}
# include

- {% raw %}`{% include <other_html> %}`{% endraw %} : `<other_html>` 을 복사해옴
    - `extends`와 달리 `block`설정 불가
    - 고정된 template을 가져옴

```html
# blog\templates\include\footer.html

<footer class="py-5 bg-dark">
    <div class="container"><p class="m-0 text-center text-white">Copyright &copy; Your Website 2023</p></div>
</footer>
```