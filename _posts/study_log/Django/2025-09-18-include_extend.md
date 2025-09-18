---
title: (Django) 4. include/extend
post_order: 4
thumbnail: https://lh3.googleusercontent.com/proxy/Ldd19vgALxCqW6j9iyCC8VZDY6Vo-w7lipagAlY09uj2-p3Lut_vF_Fxy7WcT3ROC_Cagq7BcTRWtRRftrCdZfC85WL0PuVZvGKo-prmPBQuGJKHpFIdsnwdj5q8CWMeAMeA7aXz1WhrwA
layout: post
author: jhj
categories:
  - StudyLog
  - Django
tags:
  - Django
  - manage. py
  - command
excerpt: Django manage. py 실행
project_rank: "680"
sticker: emoji//1 f 4 aa
---


# Tree

![image.png](/assets/images/study_log/Django/2025-09-18-include_extend/image.png)

# extends

- {% raw %}`{% extends <other_html> %}`{% endraw %} : `<other_html>` layout을 가져옴
- {% raw %}`{% block <block_name> %}`{% endraw %}
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

---
{% raw %}
```html
# blog\templates\blog\index.html

{% extends "_layout/default.html" %}
{% load static %}

<!-- header -->
{% block header-msg %}
    <h1 class="fw-bolder">Welcome to Blog Home!</h1>
    <p class="lead mb-0">A Bootstrap 5 starter layout for your next blog homepage</p>
{% endblock %}

<!-- content -->
{% block content %}
    <!-- content -->
    {% for post in posts%}
    <!-- Featured blog post-->
    <div class="card mb-4">
        {% if post.uploaded_image %}
            <a href="{{ post.get_absolute_url }}"><img class="card-img-top" src={{ post.uploaded_image.url }} alt="..." /></a>
        {% else %}
            <a href="{{ post.get_absolute_url }}"><img class="card-img-top" src={% static "blog/images/image.png" %} alt="..." /></a>
        {% endif %}
        
        <div class="card-body">
            <div class="small text-muted">{{ post.create_date }}</div>
            <h2 class="card-title">{{ post.title }}</h2>
            <h3 class="card-title">{{ post.category.name }}</h3>
            <p class="card-text">{{ post.content }}</p>
            <p class="card-text">{{ post.author }}</p>
            <p class="card-text">{{ post.author.last_name }}</p>
            {% if post.category %}
                <a href=""><button class="btn btn-primary" type="button">{{ post.category.name }}</button></a><br>
            {% endif %}
            <a class="btn btn-primary" href="{{ post.get_absolute_url }}">Read more →</a>
        </div>
    </div>
    {% endfor %}

    <!-- Pagination-->
    <nav aria-label="Pagination">
        <hr class="my-0" />
        <ul class="pagination justify-content-center my-4">
            <li class="page-item disabled"><a class="page-link" href="#" tabindex="-1" aria-disabled="true">Newer</a></li>
            <li class="page-item active" aria-current="page"><a class="page-link" href="#!">1</a></li>
            <li class="page-item"><a class="page-link" href="#!">2</a></li>
            <li class="page-item"><a class="page-link" href="#!">3</a></li>
            <li class="page-item disabled"><a class="page-link" href="#!">...</a></li>
            <li class="page-item"><a class="page-link" href="#!">15</a></li>
            <li class="page-item"><a class="page-link" href="#!">Older</a></li>
        </ul>
    </nav>
{% endblock %}

<!-- side widget -->
{% block side-category %}글쓰기{% endblock %}
```
{% endraw %}
# include

- `{% raw %}{% include <other_html> %}`{% endraw %} : `<other_html>` 을 복사해옴
    - `extends`와 달리 `block`설정 불가
    - 고정된 template을 가져옴

```html
# blog\templates\include\footer.html

<footer class="py-5 bg-dark">
    <div class="container"><p class="m-0 text-center text-white">Copyright &copy; Your Website 2023</p></div>
</footer>
```