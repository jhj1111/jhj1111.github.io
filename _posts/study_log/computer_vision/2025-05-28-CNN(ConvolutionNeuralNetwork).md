---
title: (vision)5. CNN(Convolution Neural Network)
thumbnail: https://media.licdn.com/dms/image/v2/D4E12AQGYlrPMNF_QgQ/article-cover_image-shrink_600_2000/article-cover_image-shrink_600_2000/0/1693868532308?e=2147483647&v=beta&t=zmNxDNVa7KAZvqqqnjVQ-UqY2NRL1CYwWViXbyQF9Hs
layout: post
author: jhj
categories:
  - StudyLog
  - ComputerVision
tags:
  - image_classification
  - vision
  - deep_learning
excerpt: 비전에서 사용되는 신경망 이론, 전파 및 학습과정
project_rank: "680"
sticker: emoji//1f4aa
---

# Layer for Vision?

![/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image01.png](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image01.png)

- deep learning의 weight는 다수의 layers로 구성되어 있음
- 그 중 가장 기본적인 형태가 지금까지 알아본 **Linear Classifier**, 즉 다항식(polynomial)임
- 하지만 Linear Classifier의 경우 **input**이 1D 구조의 column **vector 형태**로 이루어져 있음
- 이로 인해 이미지의 **공간 정보(spatial data)**를 담지 못하고, 이는 vision 인식에 치명적인 문제점임
- 이 문제점을 해결하기 위해 **CNN(Convolution Neural Network)**가 제안됨
- CNN(Convolution Neural Network)과 FCL(Fully Connected Layer)의 작동 방식은 작동방식은 기본적으로 비슷하나 구성이 바뀌었다고 이해하면 된다

# kernel(filter)

![출처: [https://medium.com/codex/kernels-filters-in-convolutional-neural-network-cnn-lets-talk-about-them-ee4e94f3319](https://medium.com/codex/kernels-filters-in-convolutional-neural-network-cnn-lets-talk-about-them-ee4e94f3319)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image1.png)

출처: [https://medium.com/codex/kernels-filters-in-convolutional-neural-network-cnn-lets-talk-about-them-ee4e94f3319](https://medium.com/codex/kernels-filters-in-convolutional-neural-network-cnn-lets-talk-about-them-ee4e94f3319)

- **kernel** 또는 **filter**라는 용어를 사용
- 크게 2가지를 생각하면 된다.

1. filter라고 하면 포토샵에서 쓰는거 아닌가? 라고 생각할 수 있는데
    1. ㅇㅇ 그 필터 맞음
    2. 이미지를 보면서 특정 부분만 강조하거나 특징을 뽑아내는 역할
    3. 즉 이미지 각 부분의 특징을 추출해 다음 layer로 전달하는 역할을 함
2. 신경망 입장에서
    1. FCL(Fully Connected Layer)의 **weight**와 비슷한 역할
    2. 즉, 고정된 필터가 아니라, **학습하면서 계속 바뀌는 필터**
    3. 포토샵처럼 사람이 직접 만든 게 아니라, **데이터를 통해 최적의 filter를 알아서 학습(backpropagation)**

- kernel의 크기는 사용자가 임의로 정하며(**hyperparameter**)
- 일반적으로 3x3, 5x5를 주로 사용
- 필터를 통해 나온 layer를 feature map, activate function을 거친 layer를 activation map이라고 함

# Slide

![[https://commons.wikimedia.org/wiki/File:CNN-filter-animation-1.gif](https://commons.wikimedia.org/wiki/File:CNN-filter-animation-1.gif)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/CNN-filter-animation-1.gif)

[https://commons.wikimedia.org/wiki/File:CNN-filter-animation-1.gif](https://commons.wikimedia.org/wiki/File:CNN-filter-animation-1.gif)

- 일반적인 필터의 작동 방식과 동일
- 일정한 임의의 크기의 필터를 **내적(dot product)**하여 하나의 픽셀 값으로 반환
- 필터를 **일정 간격(slide)**으로 이동하여 output 도출
- x와 y 방향의 slide 크기를 임의로 정할 수 있으나(**hyperparameter**)
    - x, y방향의 **크기를 동일**하게
    - **slide=1로 설정**하는게 일반적이다
- 위 그림의 예시는
    - slide=1으로 설정한 예시이며
    - slide=2로 설정할 경우 가운데 작업을 생략하여 output에서 중간 십자가 모양을 제거한 모양이 됨

# Padding

![[https://ayeshmanthaperera.medium.com/what-is-padding-in-cnns-71b21fb0dd7](https://ayeshmanthaperera.medium.com/what-is-padding-in-cnns-71b21fb0dd7)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image2.png)

[https://ayeshmanthaperera.medium.com/what-is-padding-in-cnns-71b21fb0dd7](https://ayeshmanthaperera.medium.com/what-is-padding-in-cnns-71b21fb0dd7)

- 위 필터의 예시를 보면 뭔가 이상함을 느낄 것
- 왜나하면 필터를 거칠수록 이미지의 크기가 줄어들기 때문
    - 이를 통해 이미지의 크기가 줄어들어 **layer를 깊게 쌓지 못하고**
    - **코너부분의 데이터**가 **왜곡되거나 소실**하는 문제가 발생
- 이를 방지하기 위해 위의 사진의 회색부분처럼 **더미데이터를 추가**하여 동일한 크기로 조절
- 여러가지 종류가 있으나 0을 채우는 zero padding을 가장 많이 사용(~~예외는 아직 못봄 ㅇㅇ~~)

# Receptive Fields

![[https://www.linkedin.com/pulse/deep-learning-understanding-receptive-field-computer-n-bhatt](https://www.linkedin.com/pulse/deep-learning-understanding-receptive-field-computer-n-bhatt)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/1580984517956.gif)

[https://www.linkedin.com/pulse/deep-learning-understanding-receptive-field-computer-n-bhatt](https://www.linkedin.com/pulse/deep-learning-understanding-receptive-field-computer-n-bhatt)

- 이제 위에서 설명한 개념들을 합쳐보자.
- 우리는 **kernel size**, **padding size**, **stride**를 통해 **output image의 크기(K)를 조절**할 수 있다.

![출처: [https://velog.io/@cha-suyeon/cs231n-5강-정리-Convolutional-Neural-Networks](https://velog.io/@cha-suyeon/cs231n-5%EA%B0%95-%EC%A0%95%EB%A6%AC-Convolutional-Neural-Networks)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image3.png)

출처: [https://velog.io/@cha-suyeon/cs231n-5강-정리-Convolutional-Neural-Networks](https://velog.io/@cha-suyeon/cs231n-5%EA%B0%95-%EC%A0%95%EB%A6%AC-Convolutional-Neural-Networks)

![/assets/images/study_log/computer_vision/2025-05-28-CNN(Convolution Neural Network)/image01.png](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image4.png)


- 이때 W는 input image의 크기이며
- 모든 hyperparmeter의 x, y축의 크기는 같다고 가정
- **input과 output의 크기가 같도록** padding 크기를 조절하는 것을 same padding이라 함

$$
P = (K-1)/2
$$

- 식이 뭔가 복잡해보이지만 same padding의 의미정도만 이해하면 된다.

# Convolution Layer

FCL와 같이 단순히 필터를 순서대로 처리하고 끝나면 좋겠지만 CNN에서는 depth라는 개념이 존재한다. 

이로 인해 정보가 3차원 특성을 가지게 되며, 더욱 복잡한 특징을 띄게 된다.

## Channel, Depth

![[https://medium.com/data-science/understanding-1d-and-3d-convolution-neural-network-keras-9d8f76e29610](https://medium.com/data-science/understanding-1d-and-3d-convolution-neural-network-keras-9d8f76e29610)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image5.png)

[https://medium.com/data-science/understanding-1d-and-3d-convolution-neural-network-keras-9d8f76e29610](https://medium.com/data-science/understanding-1d-and-3d-convolution-neural-network-keras-9d8f76e29610)

![출처: [https://wikidocs.net/165405](https://wikidocs.net/165405)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image6.png)

출처: [https://wikidocs.net/165405](https://wikidocs.net/165405)

- 이미지는 단순한 2차원이 아닌 3차원으로 이루어져 있음
- 일반적인 이미지는 R(Red), G(Green), B(Blue)라는 3가지 층(경우에 따라서는 +투명도)으로 구성
- 이 때 하나의 층을 **channel**이라고 함
- 결과적으로 channel의 개수를 **depth**라고 함

## Filters K

- CNN에서는 depth를 고정하지 않고 계속해서 변경해가며 사용한다.
- 일반적으로는 input과 filter의 depth는 동일하게 설정
- 연산 과정은 다음과 같다

1. input과 kernel을 channel별로 연산
    1. 이때 5x5는 input image의 각 channel, 3x3은 kernel의 channel을 의미

![Fig_07.gif](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/Fig_07.gif)

2 연산 결과를 전부 더함

![Fig_08.gif](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/Fig_08.gif)

3 모든 픽셀에 상수(bias)를 더해준다. 일반적으로 모든 픽셀에 동일한 값을 더한다.

![Fig_09.gif](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/Fig_09.gif)

![/assets/images/study_log/computer_vision/2025-05-28-CNN(Convolution Neural Network)/image01.png](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image7.png)

- 위 설명에서 보듯 하나의 kernel은 **하나의 channel을 생성**
- 따라서 하나의 layer만 거처도 1개의 channel만을 가지게 되며, 이는 학습량과 성능의 저하를 의미함
- 따라서 CNN에서는 **다수의 filter를 사용**하며, 사용한 필터의 개수를 **K**로 표현함
- 결과적으로 output의 depth($$C_{out}$$)=K **(input의 depth와 상관x)**

# Pooling Layer

![[https://www.quora.com/What-is-max-pooling-in-convolutional-neural-networks](https://www.quora.com/What-is-max-pooling-in-convolutional-neural-networks)](/assets/images/study_log/computer_vision/2025-05-28-CNN(ConvolutionNeuralNetwork)/image8.png)

[https://www.quora.com/What-is-max-pooling-in-convolutional-neural-networks](https://www.quora.com/What-is-max-pooling-in-convolutional-neural-networks)

- filter와 다르게 각 영역의 필요 정보만 추출
- activate function 처리 이후 사용
- filter와 다르게 channel별로 개별 적용(depth끼리의 연산x)
- weight끼리 연산하는게 아닌 값을 단순히 추출하므로 **hyperparmeter가 아님**
- 일반적으로 max pooling을 사용하며, 가아끄음 average pooling을 사용

| 구분 | **Max Pooling** | **Average Pooling** |
| --- | --- | --- |
| **원리** | 영역 내에서 가장 큰 값만 남김 | 영역 내 값들의 평균을 계산하여 남김 |
| **의미** | 가장 강하게 반응한 특징만 강조 | 전체적인 정보의 평균을 남김, 특징을 부드럽게 요약 |
| **특징 강조** | 강하게 반응한 feature만 남아서 더 뚜렷하게 | 전체 정보를 고르게 남기므로 세부 특징은 희석될 수 있음 |
| **잡음 대응** | 잡음이 가장 크면 그 값을 남기므로 잡음에 민감할 수 있음 | 잡음도 평균에 포함되므로 상대적으로 안정적 |
| **사용 예시** | 일반적인 CNN에서 가장 많이 사용 (특히 중간 레이어) | GoogLeNet(Inception)에서 마지막 FCL 대체용 Global Average Pooling 사용 |
| **사용 목적** | 특징 강조, 크기 축소 | 크기 축소, 파라미터 감소, Overfitting 방지 |
| **대표 사용 위치** | 중간 feature map downsampling | 마지막 layer 전 (GoogLeNet에서는 FCL 대신 사용) |
| **장점** | 특징 강조가 강해 object detection 등에 유리 | 파라미터 수 감소, overfitting 방지, 네트워크 해석 가능성 향상 |

- 왜 굳이 데이터 날려가며 pooling을 하냐 라고 생각할 수 있는데 다음과 같은 특징이 있다.

1. **데이터 크기를 줄여서 계산을 더 빠르고 효율적으로 하기 위해**
    - 가장 큰 목적
2. **필터가 찾은 특징이 특정 위치에 덜 민감해지기 위해(translation invariance)**
    - input으로 같은 물체를 사용하더라도 물체가 움직이면서 사진 내 위치가 변할 수 있음   
    - 예를 들어 고양이 귀를 찾는 filter가 있다면 귀가 사진의 왼쪽에 있든 오른쪽에 있든 pooling을 통해 크기를 줄이고 나면, **'귀가 있다는 정보만 남고, 어디에 있었는지까지는 신경 안 쓰게 되는 효과'**가 있어. - by gpt
3. **노이즈 같은 불필요한 정보는 줄이고 핵심 정보만 추출**